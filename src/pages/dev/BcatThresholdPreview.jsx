import TaskPreviewPlayer from '../../components/tasks/TaskPreviewPlayer'

// Local test drive of the BCAT threshold task without signing in: /dev/bcat-threshold
//   ?arm=vision|touch|breath   &demo=1 (about 9 trials)   &simulate=1 (simulated observer)   &practice=0
// It is the Task Library's no-save preview (TaskPreviewPlayer, stub client), so nothing is saved. Only in
// `npm run dev`: a built site (dev.radlab.zone, radlab.zone) shows nothing here; there, use the lab's
// preview /admin/tasks/preview/bcat_threshold with the same parameters.

export default function BcatThresholdPreview() {
  if (!import.meta.env.DEV) return null
  return <TaskPreviewPlayer slug="bcat_threshold" name="BCAT threshold task" />
}
