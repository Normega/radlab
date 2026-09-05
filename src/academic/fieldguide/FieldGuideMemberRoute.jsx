import FieldGuideAuthRoute from './FieldGuideAuthRoute'

// Module-level for stable identity — see the note in FieldGuideStaffRoute.
const MEMBER_ROLES = ['student', 'ta', 'instructor']

// Guard for the wiki reader. Any active enrollment passes; what that person
// can actually read is decided by RLS, not here — students match
// `members read published pages`, staff match `staff read all pages`. The
// reader UI is therefore one codebase for both, and a draft page is invisible
// to a student because the database never returns it, not because the client
// remembered to filter.
export default function FieldGuideMemberRoute() {
  return (
    <FieldGuideAuthRoute
      roles={MEMBER_ROLES}
      publicAccess
      deniedTitle="Not enrolled"
      deniedBody={email =>
        `This account (${email}) has no active enrollment in a course that uses the Field Guide. ` +
        'If you were invited, make sure you registered with the email address on the course roster.'}
    />
  )
}
