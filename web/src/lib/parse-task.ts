import * as chrono from 'chrono-node';

export type ParsedTask = {
  /** Title with the date phrase removed. */
  title: string;
  /** UTC instant, or null when no date was found. */
  dueAt: string | null;
  /** True when the student actually said a time ("6pm"), not just a day. */
  hasTime: boolean;
  /** The exact words interpreted as a date, for showing back to them. */
  matchedText: string | null;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
};

/** `!high`, `!urgent`, `!low` anywhere in the input. */
const PRIORITY_RE = /(?:^|\s)!(urgent|high|medium|low)\b/i;
/** `#tag` anywhere in the input. */
const TAG_RE = /(?:^|\s)#([\w-]{1,32})\b/g;

/**
 * Turn "Finish mathematics assignment by Monday 6 PM !high #unit3" into
 * structured fields.
 *
 * Deliberately assistive, not destructive (section 11): it returns what it
 * matched so the UI can show the interpretation for confirmation, and it never
 * fabricates a time when only a day was given -- that is what `hasTime` is for.
 *
 * Runs in the browser so the preview updates as the student types.
 */
export function parseTaskInput(input: string, referenceDate = new Date()): ParsedTask {
  let working = input.trim();

  let priority: ParsedTask['priority'] = 'none';
  const priorityMatch = working.match(PRIORITY_RE);
  if (priorityMatch) {
    priority = priorityMatch[1]!.toLowerCase() as ParsedTask['priority'];
    working = working.replace(PRIORITY_RE, ' ');
  }

  const tags: string[] = [];
  for (const m of working.matchAll(TAG_RE)) tags.push(m[1]!.toLowerCase());
  working = working.replace(TAG_RE, ' ');

  // forwardDate: "Monday" means the Monday coming, not the one just gone.
  const [result] = chrono.parse(working, referenceDate, { forwardDate: true });

  let dueAt: string | null = null;
  let hasTime = false;
  let matchedText: string | null = null;

  if (result) {
    matchedText = result.text;
    hasTime = result.start.isCertain('hour');

    const date = result.start.date();
    // Only a day was given: anchor to the end of that day rather than
    // inventing 9am, and leave hasTime false so the UI shows "Monday" instead
    // of "Monday 12:00 AM".
    //
    // setHours works in the runtime's local zone. This parser runs in the
    // browser, where local IS the student's zone, which is exactly what is
    // wanted -- see the note on this function.
    if (!hasTime) date.setHours(23, 59, 0, 0);
    dueAt = date.toISOString();

    // Strip the date phrase, plus a trailing connector it was attached to.
    working =
      working.slice(0, result.index) + working.slice(result.index + result.text.length);
    working = working.replace(/\s+(by|on|at|before|due|due\s+by)\s*$/i, '');
  }

  const title = working.replace(/\s{2,}/g, ' ').trim();

  return { title, dueAt, hasTime, matchedText, priority, tags };
}
