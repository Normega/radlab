import FieldGuideAuthRoute from './FieldGuideAuthRoute'

// Module-level so the array identity is stable — it is a dependency of the
// enrollment-check effect inside FieldGuideAuthRoute, and an inline literal
// would be a fresh array every render.
const STAFF_ROLES = ['ta', 'instructor']

// Guard for the Field Guide's authoring surfaces (/ingest, /review): an active
// 'ta' or 'instructor' enrollment on the radlab-academic project. Readers go
// through FieldGuideMemberRoute instead.
export default function FieldGuideStaffRoute() {
  return (
    <FieldGuideAuthRoute
      roles={STAFF_ROLES}
      deniedTitle="No staff access"
      deniedBody={email =>
        `This account (${email}) has no active TA or instructor enrollment. ` +
        'If you were invited, make sure you registered with the invited email address.'}
    />
  )
}
