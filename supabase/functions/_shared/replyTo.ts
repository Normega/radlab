// Reply-To addresses for outbound platform mail.
//
// The From address has to stay on a Resend-verified sending subdomain
// (mail.radlab.zone, course.radlab.zone) — that is what carries the DKIM
// signature and what U of T allowlisted. But neither subdomain has an MX
// record, so a reply sent to the From address hard-bounces with "domain not
// found". Every reply a participant or student has ever sent to platform mail
// has died that way.
//
// The apex radlab.zone does have Google Workspace MX, so these three are real,
// monitored mailboxes. Reply-To is what actually gets a human's reply to a
// human, and it changes nothing about authentication or deliverability.
//
// Unknown course codes fall back to the lab address rather than guessing:
// dropping a PSY309 student's reply into the PSY240 inbox is worse than
// routing it somewhere that is always read. (website.md §11.)

export const RESEARCH_REPLY_TO = 'research@radlab.zone'

const COURSE_REPLY_TO: Record<string, string> = {
  psy240: 'psy240@radlab.zone',
  psy309: 'psy309@radlab.zone',
}

// Accepts a course code ('PSY240') or a Lecture Lounge class slug ('psy240'),
// which are the same token in different cases.
export function courseReplyTo(codeOrSlug: string | null | undefined): string {
  return COURSE_REPLY_TO[String(codeOrSlug ?? '').trim().toLowerCase()] ?? RESEARCH_REPLY_TO
}
