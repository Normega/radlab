// The class RCT (Fall 2026) — the stress-mindset (reappraisal) arm, delivered
// as text. Companion to nonreactivity.js; same pedagogical frame.
//
// SOURCE below is Liliana's Study 3 reappraisal arm exactly as it runs
// (intervention_modules, exported 2026-09-28): the same questions, worksheets,
// trigger map, body diagram and thought records. Only the eleven training
// videos change: each becomes a guided_text lesson in LESSONS, written from her
// "Reappraisal" script document with her wording kept, at a reading pace (3
// words/s) rather than the meditative one, since these are explanations. The
// only other wording changes, all because there is no longer a video, are in
// REWORD. Her modules are untouched; these are copies under classrct-ra-* ids.
//
// Trimmed for a five-minute session (2026-09-29): the Day 1 and Day 3 lessons,
// Day 3's second scenario, and Graduation's four follow-ups after "Yes" (see
// LESSONS and DROP). Repeat days are described at "Repeats that stay fresh".

import { aboutMinutes, lightStep, pad } from './shared'
import { forTrial } from './trial'

const OWL_OUT  = 'owl_love'
const LEAD_OUT = 'You’ve finished today’s practice. Press Next for your closing check-in.'

// ── Liliana's modules, verbatim ───────────────────────────────────────────────
const SOURCE = {
  "reappraisal-phase1-day1": {
    "phase": "phase1",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "8a0aad33_reappraisal_phase1_day1_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Think about a time in your life when you performed at your highest level or experienced significant personal growth. Write briefly about this experience",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What fueled you to perform at your highest level? What motivated you to improve and grow?",
        "example": null,
        "example_label": null
      }
    ],
    "title": "The Science of Stress",
    "lesson": 1,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by two brief reflection questions. Please find a quiet spot to watch and participate fully before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Understanding Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase1-day1"
  },
  "reappraisal-phase1-day2": {
    "phase": "phase1",
    "steps": [
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What is stressing you right now? Think about something that is very real for you, and that is happening right now. It could be something related to school, work, relationships, or an upcoming responsibility.",
        "example": null,
        "example_label": null
      },
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "b56bd569_reappraisal_phase1_day2_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What are your typical PHYSIOLOGICAL responses to this stress? What sensations and changes occur in your body?",
        "example": "Sleepiness, pounding heart, or stomach ache.",
        "example_label": "Examples:"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What are your typical EMOTIONAL responses to this stress? What are the thoughts, beliefs, and feelings that you have?",
        "example": "Frustration, sadness, or wanting to get rid of stress.",
        "example_label": "Examples:"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What are your typical BEHAVIORAL responses to this stress? What actions do you take or inaction do you exhibit?",
        "example": "Arguing, eating, or avoidance.",
        "example_label": "Examples:"
      }
    ],
    "title": "Recognizing Stress",
    "lesson": 2,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session starts with a brief reflection, then a short training video, followed by three more reflection questions. Take your time with each step before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Notice Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase1-day2"
  },
  "reappraisal-phase1-day3": {
    "phase": "phase1",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "d02e40cd_reappraisal_phase1_day3_resampled.mp4"
      },
      {
        "type": "text",
        "content": [
          {
            "tag": "p",
            "text": "You will be presented with short scenarios describing a common stressful situation. Write two short interpretations of the same stress response."
          }
        ]
      },
      {
        "type": "text",
        "content": [
          {
            "tag": "h3",
            "text": "Scenario 1"
          },
          {
            "tag": "p",
            "text": "You are about to give a presentation in class, and your hands start shaking."
          }
        ]
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Threat interpretation: How might someone interpret this stress response as a threat?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Challenge interpretation: How might someone interpret this stress response as a challenge?",
        "example": null,
        "example_label": null
      },
      {
        "type": "text",
        "content": [
          {
            "tag": "h3",
            "text": "Scenario 2"
          },
          {
            "tag": "p",
            "text": "You receive feedback on an assignment and are asked to revise it before final grading. Your stomach drops when you read the comments."
          }
        ]
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Threat interpretation: How might someone interpret this stress response as a threat?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Challenge interpretation: How might someone interpret this stress response as a challenge?",
        "example": null,
        "example_label": null
      }
    ],
    "title": "Stress as Threat vs. Challenge",
    "lesson": 3,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by a written reflection exercise where you'll practice interpreting the same stressful situation in two different ways. Take your time with each step before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Reinterpret Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase1-day3"
  },
  "reappraisal-phase1-day4": {
    "phase": "phase1",
    "steps": [
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What is stressing you right now? Think about something that is very real for you and that is happening right now. It could be something related to school, work, relationships, or an upcoming responsibility.\n\nYou may use the same example from previous exercises if you'd like, or choose a new situation.",
        "example": null,
        "example_label": null
      },
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "5cbb6ca9_reappraisal_phase1_day4_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Now consider what personal values or goals are behind your stress. Complete this sentence:\n\n\"I am stressed about this because I care about …\"",
        "example": null,
        "example_label": null
      }
    ],
    "title": "I Am Overwhelmed Because I Care",
    "lesson": 4,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session starts with a brief reflection, then a short training video, followed by a fill-in-the-blank exercise connecting your stress to what matters to you. Take your time with each step before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Stress as Information",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase1-day4"
  },
  "reappraisal-phase2-day1": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "30d0bd2f_reappraisal_phase2_day1_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What do you think your typical mindset about stress is?",
        "example": "\"Stress is good for me\" or \"Stress is bad for me.\"",
        "example_label": "Examples:"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What do you think is the most adaptive or useful mindset to have?",
        "example": null,
        "example_label": null
      }
    ],
    "title": "The Power of Mindset",
    "lesson": 1,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by two brief reflection questions about your mindset toward stress. Please find a quiet spot to watch and participate fully before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Understanding Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day1"
  },
  "reappraisal-phase2-day2": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "da96481f_reappraisal_phase2_day2_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What are two ways stress can show up in a person's experience?",
        "example": "Physical, emotional, cognitive, behavioral.",
        "example_label": "e.g."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "According to the video, why does the body activate a stress response when facing challenges?",
        "example": null,
        "example_label": null
      }
    ],
    "title": "What Are Stress Signals?",
    "lesson": 2,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by two brief reflection questions about what you learned. Please find a quiet spot to watch and participate fully before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Understanding Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day2"
  },
  "reappraisal-phase2-day3": {
    "phase": "phase2",
    "steps": [
      {
        "type": "text",
        "content": [
          {
            "tag": "p",
            "text": "Welcome to the Stress Trigger Map reflection exercise. The goal of this exercise is to help you identify the triggers that tend to activate or intensify your stress response."
          },
          {
            "tag": "p",
            "text": "A trigger is a stimulus, such as a person, place, situation, thought, or thing, that contributes to an unwanted emotional or behavioral response."
          }
        ]
      },
      {
        "type": "trigger_map",
        "categories": [
          {
            "id": "emotional_state",
            "icon": "💭",
            "label": "Emotional State"
          },
          {
            "id": "people",
            "icon": "👥",
            "label": "People"
          },
          {
            "id": "places",
            "icon": "📍",
            "label": "Places"
          },
          {
            "id": "things",
            "icon": "📦",
            "label": "Things"
          },
          {
            "id": "thoughts",
            "icon": "🧠",
            "label": "Thoughts"
          },
          {
            "id": "activities",
            "icon": "⚡",
            "label": "Activities / Situations"
          }
        ],
        "instruction": "Think about moments when you usually start to feel stressed. What tends to trigger that stress? Write down one or two examples in any of the categories that feel relevant to you.",
        "min_required": 1
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Which of these categories tends to affect you the most?",
        "example": null,
        "example_label": null
      },
      {
        "type": "closing",
        "content": [
          {
            "tag": "p",
            "text": "Recognizing the triggers that intensify your stress is the first step toward learning how to respond differently."
          }
        ]
      }
    ],
    "title": "The Stress Trigger Map",
    "lesson": 3,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's practice is a written reflection exercise. You'll identify the triggers that tend to activate or intensify your stress response, then reflect on which category affects you most. Take your time before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Noticing Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day3"
  },
  "reappraisal-phase2-day4": {
    "phase": "phase2",
    "steps": [
      {
        "type": "text",
        "content": [
          {
            "tag": "p",
            "text": "When you are under stress, it can show up in different ways: in your body, emotions, thoughts, and behavior. Now that you have identified some of your common triggers, the next step is to notice how stress tends to show up for you."
          },
          {
            "tag": "p",
            "text": "Take a moment to reflect on a stressful situation you are currently experiencing, or one that comes up often in your life."
          }
        ]
      },
      {
        "type": "body_diagram",
        "title": "When I'm stressed …",
        "hotspots": [
          {
            "id": "body",
            "label": "My body feels:",
            "location": "torso",
            "auto_unlock": true,
            "unlock_after": null
          },
          {
            "id": "chest",
            "label": "I have emotions like:",
            "trigger": "input",
            "location": "chest",
            "unlock_after": "body"
          },
          {
            "id": "head",
            "label": "I start thinking:",
            "trigger": "input",
            "location": "head",
            "unlock_after": "chest"
          },
          {
            "id": "behavior",
            "label": "I behave this way:",
            "trigger": "input",
            "location": "below_figure",
            "unlock_after": "head"
          }
        ],
        "sequence": [
          "body",
          "chest",
          "head",
          "behavior"
        ],
        "instruction": "Complete each section below. Each field will unlock as you begin typing."
      },
      {
        "type": "closing",
        "content": [
          {
            "tag": "p",
            "text": "Stress signals are not random; they are your mind and body's way of responding to something that feels important or demanding."
          }
        ]
      }
    ],
    "title": "My Early Warning Signals",
    "lesson": 4,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's practice is an interactive reflection exercise. You'll explore how stress shows up in your body, emotions, thoughts, and behavior by working through a body diagram. Take your time with each step before clicking Next."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Noticing Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day4"
  },
  "reappraisal-phase2-day5": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "8a63dacb_reappraisal_phase2_day5_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Briefly describe a current difficult or stressful situation.",
        "example": null,
        "example_label": null
      },
      {
        "type": "word_select",
        "words": [
          "Distressed",
          "Upset",
          "Guilty",
          "Scared",
          "Hostile",
          "Irritable",
          "Ashamed",
          "Nervous",
          "Jittery",
          "Afraid"
        ],
        "prompt": "Select the emotion(s) that most represents what you are feeling right now. You may select as many as you would like.",
        "min_required": 1
      },
      {
        "size": "single_line",
        "type": "multi_response",
        "count": 3,
        "prompt": "List all of your automatic thoughts regarding the stressful situation. You may list up to 3.",
        "min_required": 1
      },
      {
        "max": 100,
        "min": 0,
        "type": "thought_rating",
        "prompt": "Rate the intensity of each automatic thought on a scale from 0 to 100."
      },
      {
        "type": "thought_choice",
        "prompt": "Choose the automatic thought that you feel is the most responsible for your distress."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Develop a short alternative response to the automatic thought you chose. Try to write something that feels more balanced, realistic, or helpful.",
        "example": null,
        "example_label": null
      }
    ],
    "title": "Thought Record",
    "lesson": 5,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, then guides you through a thought record exercise. You'll describe a stressful situation, identify emotions, rate automatic thoughts, and develop a more balanced response. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Cognitive Restructuring",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day5"
  },
  "reappraisal-phase2-day6": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "4dbeac3a_reappraisal_phase2_day6_resampled.mp4"
      },
      {
        "type": "word_select",
        "words": [
          "Distressed",
          "Upset",
          "Guilty",
          "Scared",
          "Hostile",
          "Irritable",
          "Ashamed",
          "Nervous",
          "Jittery",
          "Afraid"
        ],
        "prompt": "Select the emotion(s) that most represents what you are feeling right now. You may select as many as you would like.",
        "min_required": 1
      },
      {
        "size": "single_line",
        "type": "multi_response",
        "count": 3,
        "prompt": "List all of your automatic thoughts regarding the stressful situation. You may list up to 3.",
        "min_required": 1
      },
      {
        "max": 100,
        "min": 0,
        "type": "thought_rating",
        "prompt": "Rate the intensity of each automatic thought on a scale from 0 to 100."
      },
      {
        "type": "thought_choice",
        "prompt": "Choose the automatic thought that you feel is the most responsible for your distress."
      },
      {
        "type": "training_response_multi",
        "prompt": "Which cognitive distortion does your automatic thought reflect?",
        "options": [
          {
            "label": "Negative filtering",
            "example": "\"My professor gave me positive feedback, but she was probably just being nice.\"",
            "description": "Involves focusing only on negative details while minimizing positive ones."
          },
          {
            "label": "Mind reading or fortune telling",
            "example": "\"I'm going to fail,\" or \"They think I'm not good enough.\"",
            "description": "Happens when we assume we know what others think or predict negative outcomes without evidence."
          },
          {
            "label": "Catastrophizing",
            "example": "\"If this goes wrong, everything will fall apart.\"",
            "description": "When we imagine the worst possible outcome and believe we wouldn't be able to handle it."
          },
          {
            "label": "All-or-nothing thinking",
            "example": "\"If I don't do perfectly, I've failed.\"",
            "description": "Happens when we see things in extremes, with no middle ground."
          }
        ],
        "min_required": 1
      }
    ],
    "title": "Addressing Cognitive Distortions",
    "lesson": 6,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, then guides you through identifying cognitive distortions in your automatic thoughts. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Identifying Cognitive Distortions",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day6"
  },
  "reappraisal-phase2-day7": {
    "phase": "phase2",
    "steps": [
      {
        "type": "text",
        "content": [
          {
            "tag": "p",
            "text": "Now that you have begun identifying cognitive distortions, it can be helpful to focus on one common type of distorted thinking: catastrophizing."
          },
          {
            "tag": "p",
            "text": "Catastrophizing happens when we imagine the worst possible outcome and believe that if it happened, we would not be able to handle it."
          },
          {
            "tag": "h3",
            "text": "For example, thoughts like:"
          },
          {
            "tag": "p",
            "text": "\"I'm going to fail this exam.\"\n\"If this goes wrong, everything will fall apart.\"\n\"I won't be able to cope.\""
          },
          {
            "tag": "p",
            "text": "These thoughts can feel very real in the moment, especially when we are already stressed or overwhelmed."
          },
          {
            "tag": "h3",
            "text": "When we catastrophize, we tend to do three things:"
          },
          {
            "tag": "p",
            "text": "Overestimate how likely the worst-case outcome is\nOverestimate how bad it would be\nUnderestimate our ability to cope"
          },
          {
            "tag": "p",
            "text": "A helpful way to respond is to pause and ask: How likely is this outcome, really? If it did happen, how would I cope?"
          },
          {
            "tag": "p",
            "text": "This does not mean pretending that everything is fine or forcing yourself to think positively. Instead, it means stepping back and looking at the situation more realistically."
          },
          {
            "tag": "p",
            "text": "In many cases, the feared outcome is less likely than it feels, less extreme than we imagine, and more manageable than we think."
          }
        ]
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Identify a 'catastrophe' that is bothering you.",
        "example": "\"I won't get the job.\"",
        "example_label": "Example:"
      },
      {
        "max": 6,
        "min": 1,
        "type": "slider",
        "prompt": "Rate how terrible you believe it is.",
        "max_label": "Absolutely terrible",
        "min_label": "Not terrible at all"
      },
      {
        "max": 6,
        "min": 1,
        "type": "slider",
        "prompt": "What is the likelihood of the catastrophe occurring?",
        "max_label": "Very likely",
        "min_label": "Very unlikely"
      },
      {
        "max": 6,
        "min": 1,
        "type": "slider",
        "prompt": "How terrible would it be if your catastrophe really occurred?",
        "max_label": "Absolutely terrible",
        "min_label": "Not terrible at all"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What would the best possible outcome look like?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "If the worst possible scenario occurred, how would you cope?\n\n(e.g., What techniques, strategies, or people could you turn to?)",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What is the most reassuring or positive thing you would like to hear?\n\n(e.g., What would put your mind at rest, and how would it sound?)",
        "example": null,
        "example_label": null
      },
      {
        "max": 6,
        "min": 1,
        "type": "slider",
        "prompt": "Now that you have looked at the situation from different angles, rate again how terrible this outcome feels.",
        "max_label": "Absolutely terrible",
        "min_label": "Not terrible at all"
      }
    ],
    "title": "Is the World Really Ending?",
    "lesson": 7,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's practice is a written exercise about catastrophic thinking. You'll read a short passage, identify a worry that is bothering you, and work through a series of questions and rating scales to look at it more realistically. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Reality Check on Catastrophic Thinking",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day7"
  },
  "reappraisal-phase2-day8": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "72f146e1_reappraisal_phase2_day8_resampled.mp4"
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Now it's your turn! Using the example above as a guide, write down a current stressful situation. You may use the same example from earlier exercises if you'd like.\n\nSituation: What is the stressful situation?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Demands: What feels difficult, pressured, or challenging about it?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "My Resources: What strengths, supports, or strategies do you already have that could help you manage it?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Alternative Response: Based on these resources, write a more balanced or constructive way of thinking about the situation.",
        "example": null,
        "example_label": null
      }
    ],
    "title": "The Cup is Half Full",
    "lesson": 8,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by a four-part written exercise. You'll describe a stressful situation and work through its demands, your existing resources, and a more balanced way of thinking about it. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Identifying the Positives",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day8"
  },
  "reappraisal-phase2-day9": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "4971a7a1_reappraisal_phase2_day9_resampled.mp4"
      },
      {
        "size": "single_line",
        "type": "prompt_response",
        "prompt": "Think about a current stressful challenge in your life (e.g., school, work, relationships, uncertainty about the future). Briefly describe the situation in one sentence.",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Identify one or two personal values that may be connected to why this situation matters to you.",
        "example": "Learning, personal growth, responsibility, relationships, perseverance, or helping others.",
        "example_label": "Examples of values:"
      }
    ],
    "title": "I Care, Therefore I Can",
    "lesson": 9,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by two brief reflection questions connecting your stress to what matters most to you. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Using Values to Face Stress",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day9"
  },
  "reappraisal-phase2-day10": {
    "phase": "phase2",
    "steps": [
      {
        "type": "video",
        "label": "Guided reappraisal practice",
        "video_id": "084b348b_reappraisal_phase2_day10_resampled.mp4"
      },
      {
        "type": "training_response",
        "prompt": "Which strategy might be more helpful?",
        "options": [
          "Reinterpret the stress as excitement and energy for performing well.",
          "Try to ignore the situation entirely."
        ],
        "scenario": "Example 1: You feel nervous before giving an important presentation."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Why?",
        "example": null,
        "example_label": null
      },
      {
        "type": "training_response",
        "prompt": "Which strategy might be more helpful?",
        "options": [
          "Reinterpret the situation as a challenge that helps you grow.",
          "Address the situation directly or seek support."
        ],
        "scenario": "Example 2: A friend repeatedly speaks to you in a disrespectful way."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Why?",
        "example": null,
        "example_label": null
      },
      {
        "type": "training_response",
        "prompt": "Which strategy might be more helpful?",
        "options": [
          "Reinterpret the situation as a learning experience or opportunity, regardless of the outcome.",
          "Accept the uncertainty and shift your focus to something else."
        ],
        "scenario": "Example 3: You applied for a work-study position and are waiting to hear back, but there is nothing more you can do."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Why?",
        "example": null,
        "example_label": null
      }
    ],
    "title": "Is Every Battle Worth Fighting?",
    "lesson": 10,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's session begins with a short training video, followed by three scenario-based exercises. For each scenario, you'll choose the most helpful strategy and explain your reasoning. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Choosing the Right Strategy",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day10"
  },
  "reappraisal-phase2-day11": {
    "phase": "phase2",
    "steps": [
      {
        "type": "text",
        "content": [
          {
            "tag": "p",
            "text": "Stressful situations often repeat themselves, and sometimes we can't predict them. The goal of this exercise is to help you prepare and feel ready the next time you encounter a challenging situation."
          }
        ]
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Think of a stressful situation that tends to come up in your life.",
        "example": "Starting assignments, social situations, deadlines, conflict.",
        "example_label": "e.g."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "When you feel stressed in this situation, how do you usually respond?",
        "example": "Avoid it, overthink, rush, shut down, withdraw, procrastinate.",
        "example_label": "e.g."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What value or goal makes this situation important to you?",
        "example": "Growth, responsibility, relationships, independence, achievement.",
        "example_label": "e.g."
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Based on what you've learned, how could you respond differently next time?\n\nThink about: Could you reinterpret the situation? Do you need to take action? Would it help to seek support or set a boundary?",
        "example": null,
        "example_label": null
      },
      {
        "size": "long",
        "type": "prompt_response",
        "prompt": "Use what you wrote above to create a response plan.",
        "example": "Situation: I often feel overwhelmed when starting an assignment.\n\nTypical response: My typical reaction is to procrastinate and avoid starting it.\n\nValues: I do value responsibility and academic growth.\n\nResponse plan: When I notice myself avoiding the assignment, I will remind myself that this matters for my growth and choose to start with one small step.",
        "example_label": "Example:"
      }
    ],
    "title": "Ready for Next Time",
    "lesson": 11,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "Today's practice is a written exercise. You'll identify a recurring stressful situation, reflect on how you typically respond, connect it to your values, and build a personal response plan for next time. Take your time with each step."
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Building a Response Plan",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day11"
  },
  "reappraisal-phase2-day12": {
    "phase": "phase2",
    "steps": [
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Which cognitive reappraisal skills or strategies stood out most to you during these exercises?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Which practices or skills felt most helpful for you? Why?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Were there any exercises that felt less helpful or more difficult to engage with?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Did any of these practices change how you think about or respond to stressful situations?",
        "example": null,
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Are there situations in your daily life where stress or strong emotions tend to arise in predictable ways? If so, what intention could you set for yourself in those moments?",
        "example": null,
        "example_label": null
      },
      {
        "key": "will_practice",
        "type": "training_response",
        "prompt": "Do you think you will use any of these practices in your everyday life?",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "max": 6,
        "min": 1,
        "type": "slider",
        "prompt": "How likely are you to use any of these practices in your everyday life?",
        "show_if": {
          "key": "will_practice",
          "equals": "Yes"
        },
        "max_label": "Almost always",
        "min_label": "Rarely",
        "point_labels": [
          "Rarely",
          "Occasionally",
          "Sometimes",
          "Often",
          "Very often",
          "Almost always"
        ]
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "When will you practice? How often?",
        "example": null,
        "show_if": {
          "key": "will_practice",
          "equals": "Yes"
        },
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Where will you practice?",
        "example": null,
        "show_if": {
          "key": "will_practice",
          "equals": "Yes"
        },
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "What's the biggest barrier you anticipate to practicing?",
        "example": null,
        "show_if": {
          "key": "will_practice",
          "equals": "Yes"
        },
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "How can you overcome this barrier?",
        "example": null,
        "show_if": {
          "key": "will_practice",
          "equals": "Yes"
        },
        "example_label": null
      },
      {
        "size": "short",
        "type": "prompt_response",
        "prompt": "Do you have any additional comments about your experience with these exercises?",
        "example": null,
        "required": false,
        "example_label": null
      },
      {
        "owl": "Owl_graduation.png",
        "type": "closing",
        "content": [
          {
            "tag": "p",
            "text": "Stress is a natural part of life. In many situations, it signals that something important is happening, that we care about the outcome, about our goals, or about the people around us."
          },
          {
            "tag": "p",
            "text": "While we cannot eliminate stress entirely, we can influence how we respond to it."
          }
        ],
        "owl_path": "/public/assets/owls/Owl_graduation.png"
      }
    ],
    "title": "Graduation Day!",
    "lesson": 12,
    "lead_in": {
      "owl": "owl_reappraisal",
      "text": "It's Graduation Day! Congratulations on reaching the final day of this program. You did it! Over the past exercises, you explored different ways of understanding stress, noticing your stress responses, and reinterpreting stressful situations in more flexible and balanced ways. Today, you will take a few minutes to reflect on your experience with these exercises.\n\nPlease answer the following short questions:\n\n1. Which cognitive reappraisal skills or strategies stood out most to you during these exercises?"
    },
    "lead_out": {
      "owl": "owl_love",
      "text": "You've completed today's training. Please press Next to complete your post-session check-in."
    },
    "subtitle": "Reflection & Intention Setting",
    "condition": "reappraisal",
    "module_id": "reappraisal-phase2-day12"
  }
}

// ── The eleven video scripts, as guided text ──────────────────────────────────
// Strings are lines; { quiet: N } is a short pause. Trimmed for the five-minute
// day: Days 1 and 3 on 2026-09-29 and again on 2026-09-30, the thought-record
// and distortions lessons (Days 10, 11) on 2026-09-30. Cut lines were
// examples and framing; each lesson's teaching points remain.
const LESSONS = {
  "reappraisal-phase1-day1": {
    "label": "The science of stress",
    "close": "Over the next few sessions, we are going to work on learning how to embrace eustress and manage distress.",
    "lines": [
      "Stress is often seen as something bad, but it can also be helpful!",
      "First, a trip back in time. Stress, if you think about it, is designed to help us.",
      "When a saber-toothed tiger attacked us in prehistoric times, neurochemicals were released into our body to prepare us to either fight off the tiger or to run away.",
      "Moderate levels of stress get you moving toward your goals and help you marshal the resources to get something done.",
      "We see this in top athletes preparing for competition, neurosurgeons going into the operating room, and performers going on stage.",
      "Their stress primes them to be at their best. We call this eustress!",
      "When you feel overwhelmed or threatened, your stress system can’t tell the difference between physical threats, such as a saber-tooth tiger that may attack…",
      "…and social threats, such as a long list of urgent assignments or an upcoming exam.",
      "When the demands of a situation start to feel greater than the resources you have to handle it, and the sources of stress persist despite our best efforts, stress can become overwhelming.",
      "Instead of helping you focus, it can leave you feeling stuck, exhausted, or discouraged. We call this distress!",
      "So what is the stress response actually designed to do? Is it an outdated system that is no longer as useful to us?",
      "For example, subjects’ memory and performance on standard cognitive tests actually increase when they are told to put their hands into ice water, a rather stressful activity.",
      "When a group of patients was purposely stressed before going into knee surgery, they recovered at twice the rate of a control group not primed with stress.",
      "So stress is not simply good or bad. Often, it is a signal that something important is happening, and that the body is preparing to respond.",
      "How we interpret that stress can shape whether it feels more helpful or more harmful.",
      "By changing our mindset about stress, we can train ourselves to utilize our stress to find new, higher levels of performance, health, and well-being."
    ]
  },
  "reappraisal-phase1-day2": {
    "label": "Recognizing stress",
    "close": "Keep your stressor in mind as you answer the next three questions.",
    "lines": [
      "You were first prompted to think about a current stressor.",
      "Now, bring your attention to how stress showed up for you in that moment. Stress can appear in several different ways.",
      "The first category is physiological responses: sensations or physical changes that occur in your body.",
      "For example: difficulty sleeping, butterflies in your stomach, a cloudy head, a racing heart, indigestion, or fatigue.",
      "The second category is emotional responses. These are feelings that you generate when you are stressed, like frustration, sadness, or longing to get rid of the stress.",
      "The third category is behavioral responses. These are actions you take…",
      "…like picking a fight with someone, eating a pint of ice cream in one sitting, or distracting yourself from a deadline with unimportant tasks, such as scrolling through TikTok."
    ]
  },
  "reappraisal-phase1-day3": {
    "label": "Threat or challenge?",
    "close": "Is this a threat… or a challenge?",
    "lines": [
      "Stress is something we often try to avoid. But what if stress isn’t always the problem… and it’s actually how we interpret it that matters?",
      "There are two different ways of experiencing stress: distress and eustress.",
      "At one end of the spectrum is distress, which involves negative feelings and is often a difficult experience. At the other end is eustress, which is challenging but rewarding.",
      "So what determines whether stress feels overwhelming… or helpful? It often comes down to how we interpret the situation.",
      "Imagine you have an important exam coming up. Your heart starts racing. Your body feels tense.",
      "That same physical response can be interpreted in two different ways.",
      "If you see it as a threat, you might think: “I’m not ready. I’m going to fail.” This interpretation can increase anxiety and make it harder to focus.",
      "But if you see it as a challenge, you might think: “This matters to me. My body is getting ready to perform.” This interpretation can help you feel more focused and motivated.",
      "When you interpret a stressful event as a challenge, you are more likely to experience eustress: stress that feels motivating and manageable.",
      "When the same situation is interpreted as a threat, you are more likely to experience distress: stress that feels overwhelming or discouraging.",
      "The key point is: your body reacts the same way, but your interpretation changes your experience.",
      "In the short term, stress can actually improve attention, energy, and performance, especially when it’s seen as something manageable.",
      "But when stress becomes too intense or lasts too long, it can start to feel exhausting and harder to cope with.",
      "So the goal isn’t to eliminate stress. It’s to begin noticing how we interpret it."
    ]
  },
  "reappraisal-phase1-day4": {
    "label": "Stress as information",
    "close": "Behind many stressful experiences, there is often something important to you. The key is to identify what that is.",
    "lines": [
      "Why would you ever welcome stress in your life? Well, there are two reasons.",
      "First, as you have learned so far, stress increases the energy you have to overcome the challenge that is causing the stress in the first place.",
      "Working to avoid or fight stress drains your energy. Welcoming that stress can increase your energy and allows you to focus on tackling that new challenge.",
      "The second reason to welcome your stress is that embedded within everything is something that’s meaningful or important to you!",
      "For example, if I were to tell you that a child on the other side of the country is failing English, it isn’t likely to affect your stress level.",
      "But if I tell you that you are failing English, suddenly your stress levels rise, because now you have a purpose or goal embedded within that information.",
      "Behind every stress you feel, there is something important to you. The key is to find it.",
      "For example, if your stressor is a lot of unopened emails in your inbox, you might feel stress because you really want to stay on top of all your university activities and demands…",
      "…so you can make the best of your undergraduate experience, and pursue the job of your dreams."
    ]
  },
  "reappraisal-phase2-day1": {
    "label": "The power of mindset",
    "close": "Your mindset matters to your health, psychological growth, and performance.",
    "lines": [
      "At any given moment, there is a lot of information around us. To make sense of it, our minds use a lens or frame. This lens is called a mindset.",
      "A mindset shapes how we interpret situations, how we respond to them, and even how our bodies react.",
      "Let’s take a look at the placebo effect.",
      "We traditionally view the placebo as a way to test the effectiveness of a medication against an inactive substance or a dummy pill.",
      "But what the placebo effect really is, is a consistent demonstration of the power of mindset to recruit healing properties in the body.",
      "Research on the placebo effect shows that our expectations can influence real physical outcomes.",
      "When people believe they are receiving a helpful treatment, their bodies can sometimes respond as if the treatment is working, even when the treatment itself is inactive.",
      "This does not mean mindset can fix everything. But it does show that what we believe and expect can influence our physiology, emotional experience, and behavior.",
      "The same idea applies to stress!",
      "If we see stress only as harmful, we may become more distressed by the fact that we feel stressed.",
      "But if we see stress as a signal that something important is happening, we may be able to respond with more focus, energy, and confidence: eustress."
    ]
  },
  "reappraisal-phase2-day2": {
    "label": "What are stress signals?",
    "close": "Learning to recognize these signals is the first step toward responding to stress more effectively.",
    "wps": 2.6,
    "lines": [
      "Stress is a normal response to situational pressures or demands, especially if they are perceived as threatening or dangerous.",
      "When this happens, stress hormones are released, which can create changes in the body and mind.",
      "For example, your heart may beat faster, your breathing may become quicker, and your muscles may tense up.",
      "When this happens, a person’s built-in alarm system, their “fight-or-flight” response, becomes activated to protect them.",
      "Stress can also show up in other ways. The signs and symptoms of stress may be physical, emotional, cognitive (thinking-related), or behavioural. Their severity can range from mild to severe.",
      "Physical symptoms include: headaches, muscle tension or other physical pain or discomfort, stomach problems, rapid heart rate, and fatigue.",
      "Emotional symptoms include: moodiness, irritability, feeling depressed, feeling unhappy or guilty.",
      "Cognitive symptoms include: difficulty concentrating or thinking, memory problems, negativity or lack of self-confidence, constant worrying.",
      "Behavioural symptoms include: changes in eating or sleeping patterns, social withdrawal, and nervous habits such as nail biting, teeth grinding, or foot tapping.",
      "A certain amount of stress is normal and can even be helpful. Stress may help you stay alert before an exam, meet a deadline, or prepare for an important presentation.",
      "But when stress becomes too intense or lasts too long, it can start to feel overwhelming instead of helpful.",
      "The important thing to remember is that stress signals are not random.",
      "They are signs that your mind and body are responding to something that feels meaningful, challenging, or demanding."
    ]
  },
  "reappraisal-phase2-day5": {
    "label": "Automatic thoughts",
    "close": "By learning to notice them, you can begin to understand your emotional reactions more clearly and respond to them in a more helpful way.",
    "lines": [
      "If you’ve been paying attention to your emotions, you may have noticed something interesting.",
      "So what’s going on? The key to understanding emotions is recognizing the thoughts behind them.",
      "Throughout the day, your mind is constantly generating thoughts. These are called automatic thoughts: the thoughts that quickly and automatically come to mind, often without you even noticing them.",
      "For example, you might think: “I’m going to fail this.” “No one is interested in what I’m saying.” “I’m not good enough.”",
      "But in many cases, it is these automatic thoughts that shape how we feel, not just the situation itself.",
      "Here’s an example. Imagine two students receive the same feedback on an assignment. Most of the feedback is positive, but there are a few areas for improvement.",
      "One student might focus on the negative comments and think: “I’m not doing well. This is bad.” As a result, they feel discouraged or anxious.",
      "Another student might think: “I did well overall, and I can improve in these areas.” They may feel more motivated and confident.",
      "The situation is the same, but the automatic thoughts are different, and so are the emotional responses.",
      "The important takeaway is that it is not always the situation itself that determines how we feel; it is how we interpret it."
    ]
  },
  "reappraisal-phase2-day6": {
    "label": "Cognitive distortions",
    "close": "Now that you’ve learned how to identify cognitive distortions, you can begin to notice them in your own thinking.",
    "lines": [
      "Now that you have spent some time observing your thoughts, you may have noticed some patterns in the types of thoughts that seem to come up again and again.",
      "It can be helpful to begin to identify these “cognitive distortions” when they occur.",
      "We do this because our brains rely on mental shortcuts: quick ways of making sense of situations without using too much energy. Most of the time, these shortcuts are helpful.",
      "But when we apply these shortcuts too rigidly to more complex situations, they can become cognitive distortions. Let’s look at a few common examples.",
      "Negative filtering: focusing only on negative details while minimizing positive ones. “My professor gave me positive feedback, but she was probably just being nice.”",
      "Mind reading or fortune telling: assuming we know what others think, or predicting negative outcomes without evidence. “I’m going to fail.” “They think I’m not good enough.”",
      "Catastrophizing: imagining the worst possible outcome, and believing we wouldn’t be able to handle it. “If this goes wrong, everything will fall apart.”",
      "All-or-nothing thinking: seeing things in extremes, with no middle ground. “If I don’t do perfectly, I’ve failed.”",
      "But in reality, there are often many different ways of interpreting the same situation."
    ]
  },
  "reappraisal-phase2-day8": {
    "label": "Demands and resources",
    "close": "By becoming more aware of the resources available to address a challenge, you can shift how you interpret the situation, and experience stress in a more constructive way.",
    "lines": [
      "Stressful situations often feel overwhelming when we mainly focus on the demands of the situation, such as deadlines, expectations, uncertainty, or pressure.",
      "When the demands of a situation seem greater than the resources we believe we have available, stress is more likely to feel like distress.",
      "But when we recognize that we have resources to help us cope, the same situation can begin to feel more manageable, and sometimes even motivating!",
      "One way to shift this balance is to become more aware of the strengths and resources you already have.",
      "Research in positive psychology has shown that people who know their strengths and use them frequently tend to feel happier, have better self-esteem, and are more likely to accomplish their goals.",
      "However, many people have a hard time identifying their strengths. They see them as ordinary, even when they are not.",
      "A good place to start is by asking a few simple questions. What are you good at? What do you enjoy doing? In what areas of your life have you been most successful?",
      "For example, “basketball” is not a strength by itself. But discipline, athleticism, or persistence might be.",
      "You can find them by asking: “What makes you good at basketball?” or “What about yourself allowed you to be successful in this area?”",
      "Here is an example. The situation: “I have several assignments due this week.” The demands: a tight deadline and a heavy workload.",
      "My resources: “I have completed similar assignments before.” “I have great ambition, and discipline.” “I can ask course TAs for clarification if needed.” “I can create a schedule to organize my time.”",
      "So one alternative response to this situation is: “This week will be demanding, but I have handled similar workloads before and have strategies that can help me manage it.”"
    ]
  },
  "reappraisal-phase2-day9": {
    "label": "Values under stress",
    "close": "When stress starts to take over, it can be easy to lose sight of what matters most. Reconnecting with your values can help bring you back to what is meaningful, and guide how you want to respond.",
    "lines": [
      "We all experience stressful periods in life, whether they are personal, academic, relational, or connected to uncertainty about the future.",
      "One strategy that can help build resilience during stressful times is reconnecting with your personal values.",
      "Values are the qualities, beliefs, and goals that are important to you. They often guide judgment and decision-making, and they can shape your response to life events.",
      "Some examples of values: family · health · helping others · spirituality · connectedness · cooperation · equality · ethics · achievement · challenge · community · compassion.",
      "When we feel stressed, it is often because something important is at stake. In that way, stress can act as a signal that a value, goal, or important part of our life is being challenged.",
      "Research has revealed that connecting to values during a crisis promotes resiliency and strength.",
      "Privately clarifying, publicly articulating, and consciously acting on values during a crisis can help you confront the situation with optimism, determination, and inner strength.",
      "Tapping into your values can also lead you to choose more active coping strategies, such as seeking support, making a plan, or continuing to move toward what matters.",
      "In other words, values can give us a reason to keep going when things feel difficult.",
      "Consider this example. Vanessa is a third-year undergraduate student who starts to worry that she is falling behind, and begins doubting whether she is capable of succeeding in university.",
      "By reconnecting with her values of perseverance, learning, and personal growth, Vanessa finds the motivation to seek feedback, adjust her study plan, and keep working toward her long-term goals."
    ]
  },
  "reappraisal-phase2-day10": {
    "label": "Regulatory flexibility",
    "close": "The goal is not to force yourself to respond in one fixed way. The goal is to become more flexible: to respond with more clarity, intention, and effectiveness.",
    "lines": [
      "We’ve learned so far that reappraisal, reinterpreting a stressful situation, can be a very helpful strategy for everyday stressors, such as performance anxiety before an exam or a presentation.",
      "In these cases, interpreting stress as a challenge can improve focus and performance.",
      "However, in situations involving unfair treatment, harmful environments, or problems that can be directly addressed, simply “thinking positively” may not be the most helpful response.",
      "In those cases, taking action, seeking support, or setting boundaries may be more appropriate. This idea is known as self-regulatory flexibility.",
      "Self-regulatory flexibility means being able to choose the coping strategy that best fits the situation or context, rather than using a one-size-fits-all response every time.",
      "It means asking: What does this situation need right now? What response would be most helpful here?",
      "The Regulatory Flexibility Model describes three components.",
      "First, context sensitivity: evaluating the demands and opportunities of a situation. Is this a situation I can change? Is it something I need to accept for now? Is this a moment to reframe my thinking, or a moment to act, ask for help, or protect myself?",
      "Second, repertoire: having access to many ways of coping. Just like a toolbox has different tools for different jobs, we respond more effectively when we have different ways of coping with stress.",
      "And finally, feedback: the ability to monitor and adjust as needed. If one strategy is not helping, flexibility means being able to notice that and try something else.",
      "So good coping is not about always reappraising stress. It is about choosing the strategy that best fits the situation.",
      "Sometimes the best response may be reappraisal, when the situation can be viewed in a more balanced way. Problem-solving, when something can be changed.",
      "Seeking support, when you need help. Or acceptance, when the situation cannot be controlled right now."
    ]
  }
}

// ── Wording that referred to a video ──────────────────────────────────────────
const REWORD = [
  ['a short training video', 'a short lesson'],
  ['According to the video,', 'According to today’s lesson,'],
  // two automatic thoughts rather than three (2026-09-30, five-minute day)
  ['You may list up to 3.', 'You may list up to 2.'],
  [' Please find a quiet spot to watch and participate fully before clicking Next.', ''],
  [' Please find a quiet spot to watch and participate before clicking Next.', ''],
]
const reword = text => REWORD.reduce((t, [a, b]) => t.split(a).join(b), text)

const lessonStep = id => {
  const l = LESSONS[id]
  return {
    type: 'guided_text',
    label: l.label,
    wps: l.wps ?? 3,
    lines: l.lines.map(x => (typeof x === 'string' ? { text: x } : x)),
    close: l.close,
  }
}

// Steps of hers left out of the class version, by source index, with why.
const DROP = {
  // Threat vs Challenge: one scenario instead of two (2026-09-29, five-minute session).
  'reappraisal-phase1-day3': [5, 6, 7],
  // Graduation: the four follow-ups after "Yes" (when / where / barrier / overcome),
  // dropped 2026-09-29 to keep the session near five minutes.
  'reappraisal-phase2-day12': [7, 8, 9, 10],
  // …and "stood out most" (overlaps "most helpful") and the intention question (2026-09-30).
  'reappraisal-phase2-day12#more': [0, 4],
}

// A day built from one of her modules: the video becomes its lesson, every
// other step is hers, reworded only where it named the video.
const build = (day, srcId) => {
  const src = SOURCE[srcId]
  const drop = new Set([...(DROP[srcId] ?? []), ...(DROP[`${srcId}#more`] ?? [])])
  const steps = src.steps
    .filter((_, i) => !drop.has(i))
    .map(s => s.type === 'video' ? lessonStep(srcId)
      : s.type === 'prompt_response' ? lightStep({ ...s, prompt: reword(s.prompt) })
        : s.type === 'multi_response' && s.count === 3 ? { ...s, count: 2, prompt: reword(s.prompt) }
          : s)
  return {
    ...src,
    module_id: `classrct-ra-d${pad(day)}`,
    lesson: day,
    phase: 'phase1',
    day_label: `Day ${day}`,
    lead_in: { ...src.lead_in, text: `${reword(src.lead_in.text).trim()} ${aboutMinutes(steps)}.` },
    steps,
    lead_out: { ...src.lead_out, owl: OWL_OUT, text: LEAD_OUT },
  }
}

const d01 = build(1,  'reappraisal-phase1-day1')   // The Science of Stress
const d02 = build(2,  'reappraisal-phase1-day2')   // Recognizing Stress
const d03 = build(3,  'reappraisal-phase1-day3')   // Stress as Threat vs. Challenge
const d04 = build(4,  'reappraisal-phase1-day4')   // I Am Overwhelmed Because I Care
const d05 = build(5,  'reappraisal-phase2-day1')   // The Power of Mindset
const d06 = build(6,  'reappraisal-phase2-day2')   // What Are Stress Signals?
const d08 = build(8,  'reappraisal-phase2-day3')   // The Stress Trigger Map
const d09 = build(9,  'reappraisal-phase2-day4')   // My Early Warning Signals
const d10 = build(10, 'reappraisal-phase2-day5')   // Thought Record
const d11 = build(11, 'reappraisal-phase2-day6')   // Addressing Cognitive Distortions
const d13 = build(13, 'reappraisal-phase2-day7')   // Is the World Really Ending?
const d14 = build(14, 'reappraisal-phase2-day8')   // The Cup is Half Full
const d16 = build(16, 'reappraisal-phase2-day9')   // I Care, Therefore I Can
const d17 = build(17, 'reappraisal-phase2-day10')  // Is Every Battle Worth Fighting?
const d19 = build(19, 'reappraisal-phase2-day11')  // Ready for Next Time
const d28 = build(28, 'reappraisal-phase2-day12')  // Graduation Day!

// ── Repeats that stay fresh ───────────────────────────────────────────────────
// Norm, 2026-09-29, against direct repetition going stale. A repeat never
// re-reads the lesson (that is not practice); it re-runs the worksheet, and:
//   - shows the student's own words from the first time (show_back);
//   - from week 3, works on the most stressful moment of the past day or two;
//   - in week 4, lets the student choose among three worksheets.
// Only worksheets built on the student's own situation repeat, never the
// fixed-scenario days. Indices below are positions in the built module, which
// match her source (the lesson replaces the video in place).
const BACK = {
  2:  [{ index: 0, label: 'What was stressing you' }],
  4:  [{ index: 2, label: 'I am stressed about this because I care about…' }],
  8:  [{ index: 1, label: 'Your triggers' }],
  9:  [{ index: 1, label: 'How stress shows up for you' }],
  10: [{ index: 5, label: 'The thought you chose' }, { index: 6, label: 'Your alternative response' }],
  11: [{ index: 4, label: 'The thought you chose' }, { index: 5, label: 'The distortion you saw in it' }],
  13: [{ index: 1, label: 'Your catastrophe' }, { index: 6, label: 'How you would cope' }],
  14: [{ index: 3, label: 'Your resources' }, { index: 4, label: 'Your alternative response' }],
  16: [{ index: 2, label: 'Your values' }],
}
const FIRST = { 2: d02, 4: d04, 8: d08, 9: d09, 10: d10, 11: d11, 13: d13, 14: d14, 16: d16 }
const BLURB = {
  2: 'Notice how stress shows up: body, emotions, behaviour',
  4: 'Find what you care about behind the stress',
  8: 'Map what tends to trigger your stress',
  9: 'How stress shows up for you, on the body map',
  10: 'Catch an automatic thought, and answer it',
  11: 'Name the distortion in an automatic thought',
  13: 'Reality-check a catastrophe',
  14: 'Weigh the demands against your resources',
  16: 'Reconnect with the values behind the stress',
}

const showBack = first => ({
  type: 'show_back',
  heading: `On Day ${first} you wrote`,
  items: BACK[first].map(it => ({ module_id: `classrct-ra-d${pad(first)}`, ...it })),
  follow: 'Is that still what comes up, or something else?',
})
// A repeat has no lesson, so a prompt that points back at the lesson's worked
// example ("Using the example above as a guide") would point at nothing.
const noLesson = s => s.type === 'prompt_response'
  ? { ...s, prompt: s.prompt.replace(/^Now it.s your turn! Using the example above as a guide, w/, 'W') }
  : s
const exercise = first => FIRST[first].steps.filter(s => s.type !== 'guided_text').map(noLesson)
const frame = (text) => ({ type: 'text', content: [{ tag: 'p', text }] })
const RECENT_FRAME = 'Today, work with the most stressful moment from the past day or two.'

const repeatBase = (day, title, subtitle, steps, lead, label = `Day ${day} · again`) => {
  const src = Object.values(FIRST)[0]
  return {
    ...src,
    module_id: `classrct-ra-d${pad(day)}`,
    lesson: day,
    day_label: label,
    title,
    subtitle,
    lead_in: { ...src.lead_in, text: `${lead} ${aboutMinutes(steps)}. Press Next when you’re ready.` },
    steps,
  }
}

// Weeks 1–2: the same situation or a new one. Weeks 3–4: a recent moment.
const again = (day, first, recent) => repeatBase(day, FIRST[first].title, FIRST[first].subtitle, [
  frame(recent
    ? `${RECENT_FRAME} You first did this exercise on Day ${first}.`
    : `On Day ${first} you learned about “${FIRST[first].title}.” Today, practise it again with something from this week: the same situation as before, or a new one.`),
  showBack(first),
  ...exercise(first),
], `Today you return to an exercise from Day ${first}: ${FIRST[first].title}.`)

// Week 4: pick one of three worksheets, each with its own show-back.
const choice = (day, firsts) => repeatBase(day, 'Your choice', 'Choose today’s exercise', [
  frame(RECENT_FRAME),
  {
    type: 'training_response',
    key: 'pick',
    prompt: 'Which exercise would you like today?',
    options: firsts.map(f => ({ label: FIRST[f].title, description: BLURB[f] })),
  },
  ...firsts.flatMap(f => [showBack(f), ...exercise(f)].map(s => ({ ...s, show_if: { key: 'pick', equals: FIRST[f].title } }))),
], 'Today you choose which exercise to return to, with a recent stressful moment.', `Day ${day}`)

const BUILT = {
  1: d01, 2: d02, 3: d03, 4: d04, 5: d05, 6: d06, 7: again(7, 2),
  8: d08, 9: d09, 10: d10, 11: d11, 12: again(12, 10), 13: d13, 14: d14,
  15: again(15, 4, true), 16: d16, 17: d17, 18: again(18, 11, true), 19: d19, 20: again(20, 13, true), 21: again(21, 14, true),
  22: choice(22, [10, 14, 8]),
  23: choice(23, [11, 16, 4]),
  24: choice(24, [13, 10, 9]),
  25: choice(25, [14, 11, 16]),
  26: choice(26, [2, 13, 10]),
  27: choice(27, [14, 4, 11]),
  28: d28,
}
export const MODULES = Object.fromEntries(Object.entries(BUILT).map(([d, m]) => [d, forTrial(m, 'sm', Number(d))]))

const AGAIN_OF = { 7: 2, 12: 10, 15: 4, 18: 11, 20: 13, 21: 14 }
export const CALENDAR = Object.entries(MODULES).map(([day, m]) => ({
  day: Number(day),
  title: m.title,
  again: AGAIN_OF[day],
  choice: m.title === 'Your choice' || undefined,
}))
