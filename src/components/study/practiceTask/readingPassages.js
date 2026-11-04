// Passages for the reading arm of PracticeTaskStep (Sandy Study 4, step 6).
//
// `mail_sorting_centre` is Sandy's STAND-IN, copied word for word from section
// 2c of I:\Shared drives\Sandy\Study4\Design\Study_Flow_for_Norm.md and
// relaxation_step_prototype.html. Her notes on it: it may be replaced; its facts
// have not been checked against a source; at about 500 words (2 to 2.5 minutes
// plus a minute of questions) it is shorter than the 4-minute breathing practice.
//
// The passage key is saved with every response, so a replacement passage gets a
// new key rather than new text under the old one.
//
// `correct` is the index of the right option. Participants are never shown it.

export const PASSAGES = {
  mail_sorting_centre: {
    title: 'How a Mail Sorting Centre Works',
    minutes: 3,
    paragraphs: [
      'Every day, a mail sorting centre receives letters and parcels that have been collected from mailboxes, post offices and businesses. The job of the centre is to send each item toward the right address, and to do it efficiently. Most items spend only a few hours in the building, moving from one machine or work area to the next.',
      'The first step is called culling. Items arrive in large containers, mixed together, and they are separated by size and shape: standard letters, larger flat envelopes, and parcels. Each group goes to a different line, because machines work best when every item in front of them is similar. Anything that cannot go through a machine, such as an unusually shaped item, is set aside to be handled by hand.',
      'Next, the letters are turned so that they all face the same way, with the address on the same side and the stamp in the same corner. A machine takes a picture of each envelope, and a program reads the address from the image. Reading handwriting is hard for a program, so when it cannot read an address with enough confidence, the picture is sent to a person at a screen, who types in what they see. The item is then marked with a printed barcode that records where it should go.',
      'Once an item has a barcode, sorting becomes simple. The letters pass along a belt, and a scanner reads each barcode and directs the letter into one of many slots. Each slot stands for a region or a group of postal codes. When a slot fills, its contents are put into a tray and labelled, then moved to a truck, a train or a plane.',
      'At the destination, the process happens again on a smaller scale. A local centre sorts the mail by street and by delivery route, and often arranges the letters in the order that the carrier will visit each address. This is called sequencing. It means the carrier can walk or drive a route and hand over each letter without having to search through a bag.',
      'Parcels follow a similar path but are handled differently because of their weight and size. Conveyor belts carry them past scanners that read labels, and sliding arms or tilting trays push each parcel off the belt at the right chute. Heavy or fragile parcels may be handled separately.',
      'Because mail arrives throughout the day, centres often run in shifts, with the busiest period in the evening, when much of the day\'s mail has been gathered. Workers watch the machines, clear jams, and check that containers are labelled correctly.',
      'Most of the time, the system works because every step makes the next one easier. An item that is sorted into the right group early does not need to be looked at again until it reaches the person at the end of its journey.',
    ],
    questions: [
      {
        q: 'Why are items first separated by size and shape?',
        o: [
          'Because machines work best when every item in front of them is similar.',
          'Because larger items are delivered first.',
          'Because small items are more valuable.',
          'Because workers prefer to handle parcels by hand.',
        ],
        correct: 0,
      },
      {
        q: 'What happens when the program cannot read an address with enough confidence?',
        o: [
          'The item is thrown away.',
          'A person looks at the picture and types in the address.',
          'The item is sent back to the sender.',
          'The machine tries again until it works.',
        ],
        correct: 1,
      },
      {
        q: 'What does "sequencing" mean in the passage?',
        o: [
          'Sorting mail by weight.',
          'Arranging letters in the order the carrier will visit each address.',
          'Putting barcodes on envelopes.',
          'Moving mail between cities by train.',
        ],
        correct: 1,
      },
    ],
  },
}
