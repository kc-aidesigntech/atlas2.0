import type {
  IpsccCompetencyKey,
  PartnerServiceCapacityScaleOption,
  ZCodeSurveyPrompt
} from '@/features/atlas2026/shared/contracts'

/**
 * Intentional Peer Support Core Competencies (IPSCC) self-assessment catalog.
 *
 * Source of truth: references/IPS_self_assessment.pdf (Intentional Peer Support
 * Core Competencies self-assessment tool, 1-4-17). Each competency carries its
 * own 1–5 rating-scale wording under the numbers — not a generic Likert.
 */

export const IPSCC_FORM_VERSION = 'intentional-peer-support-core-competencies-v1'

export type IpsccScaleLevel = 1 | 2 | 3 | 4 | 5

/** Icon ids rendered beside competency markers in the survey card. */
export type IpsccMarkerIconId =
  | 'clock'
  | 'trending-up'
  | 'users-question'
  | 'handshake'
  | 'globe'
  | 'dove-infinity'
  | 'link-2'
  | 'eye'
  | 'refresh-cw'
  | 'sparkles'
  | 'ear'
  | 'compass'
  | 'shield'
  | 'message-circle'
  | 'heart'
  | 'target'
  | 'lightbulb'
  | 'scale'
  | 'mirror'
  | 'users'
  | 'book-open'
  | 'waypoints'
  | 'sun'
  | 'footprints'
  | 'megaphone'
  | 'scan-eye'

export interface IpsccCompetencyMarker {
  text: string
  icon: IpsccMarkerIconId
  /** Terms rendered bold inside the marker text (e.g. mutuality). */
  emphasizeTerms?: string[]
}

export interface IpsccCompetencyCatalogEntry {
  key: IpsccCompetencyKey
  number: number
  title: string
  /** Short label used in dashboards and correlation tables. */
  shortLabel: string
  description: string
  markers: IpsccCompetencyMarker[]
  /** Exact rating-scale text printed beneath scores 1–5 in the source tool. */
  ratingScale: Record<IpsccScaleLevel, string>
  /** Worked Sarah/Lisa dialogue examples for scores 1–5 from the source tool. */
  examples: Record<IpsccScaleLevel, string>
}

export const IPSCC_COMPETENCY_CATALOG: IpsccCompetencyCatalogEntry[] = [
  {
    key: 'competency_1_connection',
    number: 1,
    title: 'Connection: Nurtures and cultivates connection with others',
    shortLabel: 'Connection',
    description:
      "Demonstrates warmth, openness, curiosity and interest in others' experiences, stories and perspectives.",
    markers: [
      { icon: 'link-2', text: 'Pays attention to where we connect and what we have in common, versus getting side-tracked by differences or dislikes.' },
      { icon: 'eye', text: 'Is aware of disconnection.' },
      { icon: 'refresh-cw', text: "Reconnects with authenticity, owning one's own part." }
    ],
    ratingScale: {
      1: 'Unaware of impact on relationship of valuing or validating responses.',
      2: 'Some attention to impact on relationship of valuing and validation.',
      3: 'Intermittent attention to impact on relationship of valuing and validation.',
      4: 'Frequent attention to impact on relationship of valuing and validation.',
      5: 'Continual awareness of impact on relationship of valuing and validation.'
    },
    examples: {
      1: "Why don't you just get over it, you can't always be depressed.",
      2: "Depression is hard, but maybe you're too focused on it.",
      3: "It must be hard for you. You must be tired, but you have to remember that you'll get through it.",
      4: 'Sounds like things have been really hard for you lately.',
      5: "I can imagine that it's been really hard for you lately. I remember a time when it seemed the only thing I felt was depressed."
    }
  },
  {
    key: 'competency_2_learning_together',
    number: 2,
    title: 'Shifting the focus from Helping to Learning Together',
    shortLabel: 'Learning together',
    description:
      'Sees others as capable co-learners and responsible adults; does not take an advising or problem-solving role.',
    markers: [
      { icon: 'sparkles', text: 'Approaches relationship with curiosity and interest (vs. set ideas, assumptions and predictions).' },
      { icon: 'ear', text: "Hears what can be learned from someone else's way of looking at things rather than imposing own viewpoint." },
      { icon: 'book-open', text: 'Is open to new ideas and ways of seeing things.' }
    ],
    ratingScale: {
      1: 'Usually assumes the role of helper, with little effort to learn from or about the other.',
      2: 'Makes some effort to learn with others, but usually begins with or shifts into helping.',
      3: 'Combines helping and learning in approximately equal measure.',
      4: 'Primarily learning with each other, but occasionally shifts into helping.',
      5: 'Nearly always learning from each other.'
    },
    examples: {
      1: 'You look depressed, you should write in your journal.',
      2: "How's it going? You look a little down, maybe you should write in your journal.",
      3: "How's it going? You look a little down but I'd like to hear what you think is going on.",
      4: "I realize that I mostly know you from our talks about depression. I'd like to get to know some other things about you.",
      5: "I realize that I don't know you beyond talking about your experience. I'd like for us to get to know each other more."
    }
  },
  {
    key: 'competency_3_worldview_awareness',
    number: 3,
    title: "Worldview: Awareness of Own and Other's Worldview",
    shortLabel: 'Worldview awareness',
    description:
      'Understands that "worldview" is the way we see the world based on our own experiences.',
    markers: [
      { icon: 'compass', text: 'Is aware of own worldview and readily explores own assumptions.' },
      { icon: 'users-question', text: "Is comfortable with exploring and affirming others' worldview, listening with curiosity for the untold story." },
      { icon: 'scan-eye', text: 'Understands that trauma-awareness means listening for "what happened" rather than for "what\'s wrong".' },
      { icon: 'message-circle', text: 'Uses language that explores meaning rather than diagnosis or symptom language.' }
    ],
    ratingScale: {
      1: "Unconscious of worldview. Nearly always takes own and other's told story at face value. Worldview differences are seen as \"right or wrong\".",
      2: 'Developing awareness of differences in worldview. Conversation stays mostly on the surface. Feels that some worldviews are clearly better than others.',
      3: 'Conscious of worldview. Starting to explore and open up untold story. Still responds from a place of "knowing," but beginning to acknowledge alternate perspectives.',
      4: "Consciously exploring worldview and opening up the untold story. No longer presumes to know others' experience or have answers for them. Invites and respects alternate perspectives.",
      5: "Exploration of worldview and untold story are integrated natural responses. Does not make assumptions about others' experiences. Demonstrates deep respect and appreciation of multiple perspectives."
    },
    examples: {
      1: "You're chronically depressed; You should see your doctor.",
      2: "You've been pretty depressed lately. It might be good if you called your doctor.",
      3: "You've talked about feeling depressed - what would you think about calling your doctor?",
      4: "\"Depressed\" sounds really painful. What does 'depressed' mean for you?",
      5: 'I know what "depressed" means for me. Can you help me understand what it\'s like for you?'
    }
  },
  {
    key: 'competency_4_relationship_focus',
    number: 4,
    title: 'Shifting the focus from the Individual to the Relationship',
    shortLabel: 'Relationship focus',
    description: 'Works to co-create relationships that work well for all concerned.',
    markers: [
      { icon: 'waypoints', text: 'Notices disconnections, and is prepared to explore assumptions, patterns, power/privilege, and meaning.' },
      { icon: 'megaphone', text: 'Invites and encourages feedback about how the relationship is working for all parties concerned.' }
    ],
    ratingScale: {
      1: 'Gives little or no attention to relationship; almost entirely focused on individuals and their needs.',
      2: 'Demonstrates some awareness of relationship and the need to nurture the relationship, although the interaction is focused on individual needs.',
      3: 'Touches on relationship and nurturing the relationship in conversation, but focus is still on individual needs and concerns.',
      4: 'Attends to relationship and the need to nurture it directly in conversation, but may occasionally overlook this when it is relevant.',
      5: 'Continually aware of relationship; addresses need to nurture relationship both proactively and spontaneously in a way that deepens mutual understanding and connection.'
    },
    examples: {
      1: "I'm here to support you in your recovery.",
      2: "Let's share some ideas about what might support your recovery.",
      3: 'I got frustrated in our conversation last week, but how are you doing today?',
      4: "I got frustrated in our conversation last week. I wish you'd be more open with me in the future.",
      5: 'I got frustrated in our conversation last week. I wonder how it was for you?'
    }
  },
  {
    key: 'competency_5_mutuality',
    number: 5,
    title: 'Mutuality',
    shortLabel: 'Mutuality',
    description:
      "Actively invites and makes space for everyone's perspectives without either ignoring others or imposing.",
    markers: [
      { icon: 'handshake', text: 'Negotiates relational needs and interests in ways that work for everyone (self as well as others).', emphasizeTerms: ['mutuality'] },
      { icon: 'scale', text: 'Seeks to negotiate power and privilege in ways that work for everyone.' },
      { icon: 'users', text: 'Works to share risk and responsibility rather than taking control.' }
    ],
    ratingScale: {
      1: 'No apparent attention to creating relationships that work for everyone. Needs and interests are ignored or unilaterally asserted with little attempt at negotiation.',
      2: 'Beginning awareness of mutuality and shared responsibility. Relationship negotiations remain infrequent and inconsistent. Needs and interests are mostly ignored or unilaterally asserted.',
      3: "Aware of mutuality and shared responsibility. Relationship negotiations seek to address everyone's needs and interests, though genuine co-creation is often lacking.",
      4: 'Importance of mutuality and shared responsibility is fully appreciated. Genuine dialogue is invited to negotiate relational needs and interests.',
      5: 'Practice of mutuality and shared responsibility appears natural and organic. Relationships are negotiated in ways that appear both co-creative and inspired.'
    },
    examples: {
      1: '"I\'m here to help you" OR "Stop being so attention-seeking"',
      2: '"I can listen again if you really need me to…" OR "It\'s my turn to talk now"',
      3: '"I can listen for a while, but I\'d like to talk about myself some, too"',
      4: "We seem to be talking about depression a lot. I'd like to look at how that's working for both of us.",
      5: "This is hard to bring up. I'm feeling a bit stuck always talking about depression, and wonder what we might do differently?"
    }
  },
  {
    key: 'competency_6_hope_and_possibility',
    number: 6,
    title: 'Shifting the focus from fear to hope and possibility',
    shortLabel: 'Hope and possibility',
    description: 'Forms hope-based relationships focused on what is possible, where we are going, and how we can co-create something new.',
    markers: [
      { icon: 'sun', text: 'Focuses on what is possible.' },
      { icon: 'compass', text: 'Focuses on where we are going.' },
      { icon: 'sparkles', text: 'Focuses on how we can co-create something new.' }
    ],
    ratingScale: {
      1: 'Focuses almost entirely on "illness" and managing symptoms. Routinely imposes fear-based concerns on others.',
      2: 'Fear-focused, but able to recognize some fear-based assumptions when they are pointed out.',
      3: 'Sometimes able to see fear-based assumptions on own, and usually if pointed out. Sometimes able to shift focus to hope and possibility on own initiative.',
      4: 'Often able to focus on hope and possibility independently. Usually aware of own fears. Sometimes able to self-correct after imposing own fears on others.',
      5: 'Nearly always focuses on exploring possibilities. Aware of and owns personal fears as limited by life experience.'
    },
    examples: {
      1: "Your depression isn't going away. We need to call your doctor.",
      2: "I'm concerned that you've been depressed for so long. Should we call your doctor?",
      3: "It worries me that you've been depressed for so long. What do you think we should do?",
      4: 'It seems as though things have been rough for you. What would you like to see happen from here?',
      5: "I know you've been having a hard time, and each time we get together, we seem to have the same conversation. What's it like for you? How might we do this differently?"
    }
  },
  {
    key: 'competency_7_moving_towards',
    number: 7,
    title: 'Moving Towards versus Moving Away From',
    shortLabel: 'Moving towards',
    description:
      'Invites mutual sharing around values, hopes, dreams, possibilities and aspirations for living.',
    markers: [
      { icon: 'target', text: "Focuses on what is possible rather than what is bad, wrong, or isn't wanted." },
      { icon: 'footprints', text: 'Co-creating rather than focusing on goals or problem-solving.' }
    ],
    ratingScale: {
      1: 'Focuses on moving away from problems, problem-solving and individual goals.',
      2: 'Some awareness of possibility, but still focuses on problem-solving and individual solutions.',
      3: 'Invites moving toward what is wanted. Sometimes uses problem-solving language.',
      4: 'Consistently invites moving toward what is wanted, co-creating a focus on the relationship.',
      5: 'Possibilities evolve naturally from the conversation.'
    },
    examples: {
      1: "You've got too much going on. Just stop doing so much!",
      2: "You'll feel better if you take better care of yourself and don't get so over-extended.",
      3: "Gosh, we've been talking a lot about depression lately. Maybe you'd feel better if you had some goals.",
      4: "I wonder what might be different in our relationship if our focus wasn't on depression? What would you rather feel?",
      5: 'I can hear your dark feelings have got you stuck. I know that feeling. What might it look like if we were working together to get unstuck?'
    }
  },
  {
    key: 'competency_8_self_reflection',
    number: 8,
    title: 'Self-Reflection',
    shortLabel: 'Self-reflection',
    description:
      "Actively reflects on the experience of self in relationship — able to 'own one's own part'.",
    markers: [
      { icon: 'mirror', text: 'Is aware of own worldview and how it developed, including personal feelings, thoughts, attitudes, assumptions, judgments, agendas, power, privilege, defaults and patterns.' },
      { icon: 'trending-up', text: 'Welcomes differences in experiences / perspectives / beliefs / judgments as opportunities to learn and grow.' },
      { icon: 'shield', text: 'Resists the tendency to blame others for uncomfortable feelings.' },
      { icon: 'heart', text: 'Uses self-awareness to build connection by being transparent, approachable and authentic.' }
    ],
    ratingScale: {
      1: 'Unaware of, or not interested in, how own values and assumptions affect relational interactions.',
      2: 'Shows some recognition of own values and assumptions but continues to impose them on others.',
      3: 'Generally able to identify own values and assumptions. Mixed success in refraining from imposing these on others.',
      4: 'Aware of, and willing to own, values and assumptions. Avoids imposing them on others. Able to acknowledge and self-correct as needed.',
      5: 'Deep awareness of own values and assumptions. Uses self-disclosure and transparency to further mutual exploration and relational connection.'
    },
    examples: {
      1: 'You need to listen better. I just told you what worked for me.',
      2: "I realize that not everything that's worked for me will work for you but at least you should try it.",
      3: "I realize that not everything that's worked for me will work for you.",
      4: "I realize I've quietly been pushing my own agenda so I'd like to work towards noticing when my agenda seems to come up.",
      5: "I'm feeling a little uncertain right now. How would you like me to respond when you tell me you're depressed?"
    }
  },
  {
    key: 'competency_9_feedback',
    number: 9,
    title: 'Able to Give and Receive Feedback',
    shortLabel: 'Give and receive feedback',
    description: 'Ensures connection while inviting and giving honest responses.',
    markers: [
      { icon: 'heart', text: "Acknowledges and appreciates others' positive contributions." },
      { icon: 'scan-eye', text: "Looks at the situation through the lens of the other person's life experience, in addition to one's own." },
      { icon: 'scale', text: 'Considers whether own worldview is a reflection of privilege or bias.' },
      { icon: 'eye', text: 'Frames feedback around observation rather than judgment.' },
      { icon: 'trending-up', text: "Keeps the focus on moving towards what is wanted for the relationship rather than away from what isn't wanted." },
      { icon: 'refresh-cw', text: "Validates other's response and demonstrates willingness to learn and be changed by what they have shared." }
    ],
    ratingScale: {
      1: "Fails to allow space for others' experience or consider 'own part' when receiving feedback or difficult messages.",
      2: "Makes some effort to acknowledge others' experience or 'own part' when receiving feedback or difficult messages.",
      3: "Both acknowledges others' experience and 'own part' when receiving feedback or difficult messages. The conversation takes on an appreciably mutual tone.",
      4: "Others' experience and own part are fully acknowledged. A deeper understanding is actively sought. Mutual learning is apparent.",
      5: "Receives feedback in a way that naturally deepens relational connection. Validates others' experience, acknowledges own part and opens door to mutual growth."
    },
    examples: {
      1: "I am too depressed – you're just like everyone else! OR You're right. I must be faking it.",
      2: "Don't get frustrated. I can't help it. I'm just so depressed.",
      3: "It's hard for me to hear what you're saying, but maybe it's true…Maybe I need to change.",
      4: "I didn't know you felt that way. I'd like to hear more. Maybe it is a pattern for me.",
      5: "I guess I hadn't really been paying attention. It was just so nice to have someone listen and be there for me. I guess I kind of forget that there were two of us here. What was it like for you?"
    }
  },
  {
    key: 'competency_10_co_reflection',
    number: 10,
    title: 'Co-Reflection',
    shortLabel: 'Co-reflection',
    description: 'Attends co-supervision regularly and uses it for mutual growth.',
    markers: [
      { icon: 'clock', text: 'Shows up prepared and on time.' },
      { icon: 'trending-up', text: 'Readily identifies areas for personal learning and growth.' },
      { icon: 'users-question', text: "Expresses curiosity about others' intentions and aspirations for co-learning." },
      { icon: 'handshake', text: 'Maintains connection, mutuality and actively cares for relationships with co-participants.', emphasizeTerms: ['mutuality'] },
      { icon: 'globe', text: 'Listens for worldview and explores power and privilege and their impact.' },
      { icon: 'dove-infinity', text: 'Maintains attitudes of hope, possibility, co-learning, co-creation and moving toward during co-reflection.' }
    ],
    ratingScale: {
      1: 'No observable commitment to co-supervision. Rarely attends, or gets stuck in blaming or fixing.',
      2: 'Some observable commitment to co-reflection; demonstrates some willingness to grow in relationships.',
      3: 'Observable commitment to co-reflection. Attends regularly and demonstrates clear interest in relational growth.',
      4: 'Actively participates and uses co-reflection to deepen understanding of — and connection with — self and others.',
      5: 'Participates in co-reflection that inspires mutual growth, connection and understanding.'
    },
    examples: {
      1: "Lisa is a difficult peer. She's always complaining and expecting me to take care of her. She needs to work on this in her therapy.",
      2: "I feel frustrated because of a peer's co-dependency. She's got so much potential. How can I get her to see that?",
      3: "I don't understand someone I've been working with. I'd like to know what she wants from me.",
      4: "I realize I've been trying to 'help' someone else 'get better' and it's based on my agenda. I wonder what I should do - should I go apologize to her?",
      5: "I've been pretty uncomfortable. Someone I know has had some really low feelings for several weeks now. I realize I'm responding out of fear."
    }
  }
]

/** One score per competency — the PDF rates competencies, not free-floating item banks. */
export const IPSCC_COMPETENCY_DEFINITIONS = IPSCC_COMPETENCY_CATALOG.map((entry) => ({
  key: entry.key,
  label: entry.shortLabel,
  itemIndexes: [entry.number]
}))

export function getIpsccCompetencyByKey(key: IpsccCompetencyKey) {
  return IPSCC_COMPETENCY_CATALOG.find((entry) => entry.key === key) || null
}

export function buildIpsccScaleOptions(entry: IpsccCompetencyCatalogEntry): PartnerServiceCapacityScaleOption[] {
  return ([1, 2, 3, 4, 5] as const).map((value) => ({
    value,
    // Short stem for the selected-state line; full PDF wording stays in description.
    label: `level ${value}`,
    description: entry.ratingScale[value]
  }))
}

/**
 * Adapt a competency into the Z-code survey prompt shape so BurdenCard can
 * render the same question chrome without a one-off survey shell.
 * Bullets stay out of this string — IpsCompetencySurvey lays them out in a grid.
 */
export function buildIpsccSurveyPrompt(entry: IpsccCompetencyCatalogEntry): ZCodeSurveyPrompt {
  return {
    id: entry.key,
    parentCode: 'IPSCC',
    parentTheme: 'Intentional Peer Support Core Competencies',
    zCode: `C${entry.number}`,
    normalizedZCode: `C${entry.number}`,
    title: entry.title,
    description: `${entry.title}. ${entry.description}`.trim()
  }
}

export function describeIpsccScore(
  entry: IpsccCompetencyCatalogEntry,
  score: number
): { value: number; label: string; description: string } | null {
  if (!Number.isFinite(score) || score < 1 || score > 5) return null
  const level = Math.round(score) as IpsccScaleLevel
  return {
    value: level,
    label: `level ${level}`,
    description: entry.ratingScale[level]
  }
}
