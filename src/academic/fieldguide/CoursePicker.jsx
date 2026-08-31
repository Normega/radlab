// Course selector for the staff queues that load ONE course's data at a time.
//
// Not used by the roster, which takes its course from the URL instead: that
// page bulk-imports and bulk-emails, and a picker with a default still lets a
// destructive action land on the wrong course if nobody looks at it. Not used
// by SubmissionsQueue either, which spans courses by design and reads the
// course off each row.
//
// Renders nothing for a single course. A select with one option is furniture
// that implies a choice you do not have.

export default function CoursePicker({ courses, value, onChange, style }) {
  if (courses.length < 2) return null
  return (
    <select style={style} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      {courses.map(e => (
        <option key={e.course_id} value={e.course_id}>
          {e.courses.code} — {e.courses.name}
        </option>
      ))}
    </select>
  )
}
