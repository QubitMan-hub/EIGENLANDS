/**
 * Hadamere's voices: everything the ten villagers say beyond the basic lines in npcs.ts.
 * Pure data + a pure line composer, used by the server (dialogue) and the client (ambient chatter, statue lore).
 */
import type { Weather } from './weather';
import { NPCS, NPC_BY_ID, tierOf, hearts, type NpcDef } from './npcs';

/** Things the player did recently that villagers can remember and comment on. */
export type DeedKind =
  | 'harvest'
  | 'fish'
  | 'rare_fish'
  | 'forge'
  | 'perfect_forge'
  | 'smelt'
  | 'cook'
  | 'discover'
  | 'bug'
  | 'kill'
  | 'quest'
  | 'statue'
  | 'sell'
  | 'plant'
  | 'gift_love';
export const DEED_KINDS: DeedKind[] = [
  'harvest',
  'fish',
  'rare_fish',
  'forge',
  'perfect_forge',
  'smelt',
  'cook',
  'discover',
  'bug',
  'kill',
  'quest',
  'statue',
  'sell',
  'plant',
  'gift_love',
];

export interface HeartEvent {
  /** shown once the player reaches this many hearts */
  hearts: number;
  title: string;
  /** cutscene pages, shown one after another */
  pages: string[];
  choices: Array<{ text: string; reply: string; pts: number }>;
}

export interface Voice {
  greet: { morning: string[]; day: string[]; evening: string[]; night: string[] };
  /** already talked today */
  again: string[];
  /** small talk by friendship tier (acquaintance, friend, close) */
  chat: [string[], string[], string[]];
  bye: string[];
  accept: string[];
  decline: string[];
  /** handing in a finished job */
  thanks: string[];
  /** "tell me about yourself", revealed further with friendship */
  about: [string, string, string];
  town: string;
  qubitman: string[];
  /** '{rumor}' is replaced by the rumor text */
  rumorIn: string[];
  noRumor: string;
  /** '{item}' = the last gift */
  memory: string[];
  /** '{what}' = detail of the deed (crop, fish, item...) */
  deeds: Partial<Record<DeedKind, string[]>>;
  /** ambient chatter bubbles */
  barks: { work: string[]; free: string[] };
  /** shop closed */
  closed: string;
  events: HeartEvent[];
}

const V: Record<string, Voice> = {
  // ───────────────────────────── Orla: the mayor. Warm, list-making, gently nosy. Keeper of the Ledger of Arrivals.
  orla: {
    greet: {
      morning: [
        'Good morning! I have three meetings, two complaints and one pastry. Walk with me.',
        'Morning! The ledger is open and the ink is fresh. A good sign.',
        'Ah, an early riser. I approve. I approve of very little before nine.',
      ],
      day: [
        'Hello, hello! Is it a visit, a complaint, or a compliment? I file them separately.',
        'There you are! The village was just asking about you. Well. I was.',
        'Good afternoon! Have you eaten? Maribel will ask, and I like to be ahead of Maribel.',
      ],
      evening: [
        'Evening. This is the hour when Hadamere stops pretending to be busy. My favorite.',
        'Ah, supper time. The one meeting everybody attends.',
        'Good evening! Sit, if you like. The day has been long and mostly paperwork.',
      ],
      night: [
        "Shouldn't you be asleep? So should I, but here we are.",
        'Up late? The stars here are very well behaved. I had nothing to do with it.',
      ],
    },
    again: [
      "Back so soon? I'll start a separate page for you.",
      "Something else? I'm all ears. And a pencil.",
      "Mm? Don't mind me, I'm alphabetizing my worries.",
    ],
    chat: [
      [
        'A village is a promise people keep to each other every morning. I just keep the minutes.',
        "If you need anything, ask. If you need nothing, ask anyway. That's how friendships start.",
        'The well in the plaza is older than the village. We built the village around it, like sensible people.',
      ],
      [
        'I put your name in the ledger, under "reliable". It\'s a short list. Odo is on it, under protest.',
        'Do you know, the children have started calling you "the new one"? It\'s a promotion from "who\'s that".',
        "Between us, Tobin raises his prices whenever I walk in. I've started sending Juniper.",
      ],
      [
        "You're one of us now. That means you get invited to the meetings. I'm sorry.",
        'Some mornings I look at the plaza and think: we built this from a fog. And then I think: I need more benches.',
        "If I ever retire, I'll need someone who can listen to complaints and smile. Just a thought. Just a small thought.",
      ],
    ],
    bye: ['Off you go! Mind the cobbles.', "Until later. I'll make a note.", 'Goodbye, dear. Come back with news.'],
    accept: [
      "Wonderful! I'll add it to the list. The good list.",
      "Splendid. I knew I could count on you. I count on everyone, it's my job.",
    ],
    decline: [
      'No hurry at all. The ledger is patient. I am mostly patient.',
      "Of course. Come back when you're ready.",
    ],
    thanks: [
      "Marvelous work. I'm writing it down, in ink.",
      'Thank you! Hadamere is better for it, and so is my mood.',
    ],
    about: [
      "I'm the mayor. Which mostly means I own the biggest ledger and the smallest desk.",
      'I came here as a surveyor, thirty years ago, to measure the valley. I measured it. Then I stayed. Some things you measure and they keep you.',
      'My grandmother was one of the first families. She told me she saw QubitMan look at the river until it decided which way to flow. I have never seen him. I have spent my whole life keeping his village tidy, just in case he comes back to check.',
    ],
    town: 'Hadamere: ten houses, one plaza, one statue, and opinions enough for a city. The smithy and my hall are north, the store is west, the farm east, the pond south. And the request board by the plaza lists what everyone needs today.',
    qubitman: [
      'ALL HAIL QUBITMAN. I say it every morning, before tea. Tradition is just a habit with a good story.',
      'Grandmother said he had a lantern with a single light in it, and that the light was two colours until you looked at it. She also said cabbages can hear you. I believe her about the lantern.',
    ],
    rumorIn: [
      "Now, I don't gossip. I merely keep records. And the record says: {rumor}",
      "Official business: {rumor} Unofficially: isn't that something?",
    ],
    noRumor: "Nothing noteworthy today. I'm almost disappointed.",
    memory: [
      "I still have the {item} you gave me. It's on my desk, next to the important papers. Above them, actually.",
      'The {item} was lovely. I\'ve written it down: "a person of taste".',
    ],
    deeds: {
      quest: ["I heard you helped {what}. That's going straight into the ledger."],
      statue: [
        "You've read the plaque! Now you're officially a Hadamerean. There's no certificate. I'm working on it.",
      ],
      harvest: ['A harvest of {what}, I hear! Our soil likes you.'],
      rare_fish: ['A {what}! Sedge will be insufferable about it. Well done.'],
      perfect_forge: ['A perfect forging! Brannoch smiled. I have it on good authority. The authority is me.'],
      gift_love: ['I heard you made {what} very happy. Kindness is the best civic infrastructure.'],
    },
    barks: {
      work: [
        'Item four: the fence by the pond. Again.',
        'Who signed this in crayon? Juniper.',
        'Hmm. The numbers add up. Suspicious.',
        'Measurement Day is in… oh dear.',
      ],
      free: [
        'Lovely evening.',
        "Ah, Maribel's stew. I can smell it from here.",
        'ALL HAIL QUBITMAN. …Yes, I say it to myself too.',
        'Good evening, good evening!',
      ],
    },
    closed: "The mayor's office is closed, but the mayor is not. What can I do?",
    events: [
      {
        hearts: 2,
        title: 'The Ledger of Arrivals',
        pages: [
          "Come, sit with me a moment. I want to show you something I don't show everybody.",
          'This is the Ledger of Arrivals. Every soul who came to Hadamere meaning to stay is written in here. Three hundred and twelve names. Four of them are goats, but that was a clerical dispute.',
          "The very first line isn't a name at all. It's a circle with a line through it. My grandmother swore it was his signature.",
          'And here, at the bottom of the newest page, in my best ink… you.',
        ],
        choices: [
          {
            text: "I'm honored.",
            reply: "As you should be. I don't waste the good ink on just anyone. Odo got the pencil.",
            pts: 10,
          },
          {
            text: 'What does the circle mean?',
            reply:
              'Grandmother said it means "zero and one, and everything in between". She also said cabbages can hear you. I keep both in mind.',
            pts: 15,
          },
          {
            text: 'Can I see who came before me?',
            reply:
              "Absolutely not, the Ledger is confidential! …Page three. Odo arrived wearing one boot. Nobody has ever asked him why. Don't you dare.",
            pts: 5,
          },
        ],
      },
      {
        hearts: 5,
        title: "Bram's Benches",
        pages: [
          'Do you see these benches? Bram built every one of them. My husband. He had hands like Odo and patience like the pond.',
          "He used to say a village needs places where people can sit and say nothing together. I thought it was a joke. It took me years to understand it wasn't.",
          "He's been gone eight winters. I still come here at noon, and sit, and say nothing. It helps.",
        ],
        choices: [
          {
            text: 'Tell me about him.',
            reply:
              "He laughed at his own jokes before he finished them. He couldn't carry a tune, so he carried everyone's groceries instead. …Thank you for asking.",
            pts: 20,
          },
          { text: '(Sit beside her and say nothing.)', reply: '…  …Thank you. That was exactly right.', pts: 25 },
          {
            text: 'Benches are important civic infrastructure.',
            reply: 'Ha! Now you sound like me. Bram would have laughed until he fell off it.',
            pts: 10,
          },
        ],
      },
      {
        hearts: 8,
        title: "The Mayor's Secret",
        pages: [
          'May I tell you something I have never told anyone? Not even Maribel, and Maribel knows what I had for breakfast the winter the well froze.',
          "I don't know if QubitMan was real. I've read every page, every letter, every scribble. Nobody I trust ever saw him.",
          'But every morning, the whole village says "all hail" in that silly way, and smiles, and goes to work. They hold together. Maybe that\'s what he measured: not the river. Us.',
          'Is it terrible, to keep a statue polished for someone who might not exist?',
        ],
        choices: [
          {
            text: 'Maybe believing is the measurement.',
            reply: "…Wren would love that. I think I do too. Yes. I'll write that down. In the good ink.",
            pts: 30,
          },
          {
            text: "He's real. Juniper says she's seen him.",
            reply: 'Juniper has also seen a goose that can count. But… thank you. It helps, hearing it from you.',
            pts: 20,
          },
          {
            text: 'Your secret is safe with me.',
            reply: "I know it is. That's why I told you. Now: not a word to Maribel. She'd bake a cake about it.",
            pts: 25,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Tobin: the storekeeper. Cheerful haggler, thinks in prices, secretly sentimental.
  tobin: {
    greet: {
      morning: [
        'Morning! Prices are fresh, seeds are fresher. Have a look.',
        "Ah, my first customer of the day! That's lucky. For one of us.",
        'Rise and shine and spend!',
      ],
      day: [
        "Seeds, string, second chances. What'll it be?",
        "Welcome to Greenbough's! If we don't have it, you didn't need it.",
        'Afternoon! Business is brisk. Business is always brisk when you say it confidently.',
      ],
      evening: [
        "Evening! The store's closed but my mouth isn't.",
        'Lovely evening for counting. Coins, stars, regrets.',
      ],
      night: ['Closed? Never. Just quiet.', 'Up late? Me too. I dreamt about inventory again.'],
    },
    again: [
      "Forgot something? Everyone forgets something. That's my business model.",
      "Back already! I'll pretend I'm surprised.",
      "Mm? Make it quick, I'm in the middle of a very important stack of beans.",
    ],
    chat: [
      [
        "If a price drops, it's because everyone sold the same thing. Spread your harvest around.",
        'The market is a living thing. Feed it variety.',
        'Everything is worth something to somebody. Finding the somebody is the trick.',
      ],
      [
        "For you, I'll even dust the good shelf.",
        'You know what sells in winter? Optimism. And frostroot seeds.',
        'A tip from a friend: sell to whoever pays most. Brannoch pays more for metal, Sedge for fish, Maribel for food.',
      ],
      [
        "My favorite customer! Don't tell the others, they get jealous.",
        "I'd run out of seeds before I ran out of reasons to like you.",
        'If I ever write a book on commerce, you\'re in chapter one. Chapter one is called "people who come back".',
      ],
    ],
    bye: [
      'Come again! Bring coins. Or friends with coins.',
      'Pleasure doing business!',
      "Off you go. Don't let the door hit your wallet.",
    ],
    accept: ["Splendid! I'll consider it an investment.", 'Deal! I love a deal. Even the ones with no money in them.'],
    decline: ['No pressure. The offer stands, like my prices.', 'Fair enough. Supply, demand, timing.'],
    thanks: ['Pleasure doing business! Here, your cut.', 'Ha! Good work. My ledger and my heart both thank you.'],
    about: [
      "Tobin Greenbough, purveyor of fine goods and finer conversation. The store's been here twelve years. So have I, coincidentally.",
      "I was a peddler. Wheels, roads, a different town every week. Then my cart broke a wheel right outside Hadamere. Odo fixed it for free and wouldn't take a coin. I never left. I'm still trying to pay him back.",
      "I keep a jar under the counter: the first coin from every first customer. Three hundred and some. Yours is in there. Sometimes, when business is slow, I take them out and remember the faces. Don't tell anyone. Bad for my reputation as a heartless capitalist.",
    ],
    town: "Hadamere is a fine market town, if you squint. My store's on the west side. Sell crops to me, fish to Sedge, metal to Brannoch, food to Maribel. And check the request board in the plaza; people pay well when they're desperate.",
    qubitman: [
      'QubitMan? Wonderful for tourism. I\'ve been trying to get Odo to carve little statues to sell. He says it\'s "undignified". I say it\'s "profitable".',
      'Legend says he made the soil choose to be fertile. Best thing that ever happened to the seed business.',
    ],
    rumorIn: ['Word on the shop floor: {rumor}', 'A customer told me, and customers are always right: {rumor}'],
    noRumor: 'No gossip today. Bad for business, gossip. Good for business, actually. Anyway, none.',
    memory: [
      "That {item} you gave me? I priced it. Then I un-priced it. It's not for sale. It's mine.",
      "I'm still thinking about that {item}. Good taste. Excellent margins.",
    ],
    deeds: {
      sell: ["I hear you've been selling around town. Healthy competition! For me, I mean. I'm healthy."],
      harvest: [
        "A fine crop of {what}, I hear. If you're selling, I'm buying. If everyone's selling, I'm buying cheaper.",
      ],
      quest: ['Heard you sorted out {what}. Good for the village, good for trade.'],
      rare_fish: ["A {what}! Do you know what those go for? I do. I'm not telling. Negotiation."],
      statue: ['Read the plaque, did you? Ten coins to read it for you next time. Kidding! Fifteen.'],
    },
    barks: {
      work: [
        'Turnips, two for the price of… two.',
        "Who's been moving my beans?",
        'Fresh seeds! Ask about our seeds!',
        'Hmm. Up a copper on melons.',
      ],
      free: [
        'Ah, fresh air. Smells like profit.',
        'Evening, neighbor!',
        'Somebody should sell lemonade on this plaza. Somebody. Me.',
      ],
    },
    closed: "Store's closed for the night, friend. Open eight to six. Come back with your coins in the morning!",
    events: [
      {
        hearts: 2,
        title: 'The Jar of First Coins',
        pages: [
          "Psst. Come behind the counter. No, it's fine, it's a special occasion. Mind the beans.",
          "See this jar? Every customer's first coin. I never spend them. Three hundred and forty-one coins, three hundred and forty-one faces.",
          "This one's yours. A little scratched. I like it. Looks like it's been places.",
        ],
        choices: [
          {
            text: "That's really sweet, Tobin.",
            reply: "Sweet! Bah. It's… inventory. Sentimental inventory. Go on, before I charge you for the tour.",
            pts: 15,
          },
          {
            text: 'Can I have it back?',
            reply:
              "Absolutely not! It's part of the collection. I'll give you a different coin. Which you'll then spend here.",
            pts: 5,
          },
          {
            text: "What's the oldest coin?",
            reply: "Orla's. She paid for a pencil and asked for a receipt. Of course she did.",
            pts: 10,
          },
        ],
      },
      {
        hearts: 5,
        title: 'The Broken Wheel',
        pages: [
          "You ever wonder why a peddler stops peddling? I'll tell you. It was raining. My cart hit the stone by the south road and the wheel just… quit.",
          "I sat there in the mud, cursing in four currencies. And this big grumpy man walks up with a toolbox, doesn't say a word, and fixes it.",
          "Odo. Wouldn't take a coin. I've been trying to pay him back for twelve years. He keeps refusing. It's infuriating. It's the best thing that ever happened to me.",
        ],
        choices: [
          {
            text: 'Maybe staying was the payment.',
            reply:
              "…Huh. I never thought of it that way. Don't tell Odo you said something wise. He'll get suspicious.",
            pts: 25,
          },
          {
            text: 'You should tell him.',
            reply:
              "Tell Odo a feeling? He'd build a shed to hide in. No, I'll keep overpaying for his planks. He knows.",
            pts: 15,
          },
          {
            text: 'Do you miss the road?',
            reply:
              'Every spring. Then I remember mud, and bandits, and rain in my socks. Then I miss it a little less.',
            pts: 10,
          },
        ],
      },
      {
        hearts: 8,
        title: 'The Real Ledger',
        pages: [
          "I'll trust you with my greatest secret. You must never tell. My reputation depends on it.",
          'I undercharge. Juniper pays half for everything. Old Mrs. Hale gets her flour for "a smile". Fenwick thinks fertilizer costs half what it does.',
          'There. Now you know. Tobin Greenbough, the sharpest trader in the valley, is a complete soft touch.',
        ],
        choices: [
          {
            text: "Your secret's safe. You're a good man.",
            reply:
              "Good man, bad businessman. Somebody has to be. Here: I'm giving you the friends-and-family price from now on. Don't look at the tags.",
            pts: 30,
          },
          {
            text: 'I knew it all along.',
            reply: 'You did not! …Did you? Was it the turnips? It was the turnips.',
            pts: 20,
          },
          {
            text: 'Does that mean discounts for me?',
            reply: 'Ha! It means you know too much. Fine. A small one. A very small one. In spirit.',
            pts: 15,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Brannoch: the smith. Terse, speaks in metal, hums at the forge. Forged his own left hand.
  brannoch: {
    greet: {
      morning: [
        'Mm. Morning. Forge is warm.',
        "You're up. Good. Metal likes early hands.",
        "Morning. Don't touch the anvil.",
      ],
      day: [
        'Mm. You want something forged, or just warm hands?',
        'Hm. You again. Good.',
        "Speak. Quickly. The iron's cooling.",
      ],
      evening: ["Day's done. Iron's resting. So am I.", "Mm. Evening. Sit if you want. Don't talk if you can help it."],
      night: ["The forge doesn't care what time it is. Neither do I.", 'Night. Coals still glowing. Like thoughts.'],
    },
    again: ['Mm?', 'Still here. Still listening.', 'Something else. Go on.'],
    chat: [
      [
        'Match the phases. Two metals that sing the same note make something stronger than either.',
        'Opposite phases cancel. Use that to quiet a flaw.',
        'Hit on the beat, not near it. The metal knows.',
      ],
      [
        "You're getting a feel for the rhythm. Keep at it.",
        "Copper's orange, iron's blue. Opposites on the wheel. Fight each other. Calm each other.",
        'A good hammer weighs what your arm forgets.',
      ],
      [
        "You're the only one who understands why I hum at the forge. Stay a while.",
        'A good blade, a good friend. Both take a long time to make.',
        "When I'm gone, someone should keep this fire. Just saying. Not saying. Mm.",
      ],
    ],
    bye: ['Mm.', 'Go on.', 'Keep your hands warm.'],
    accept: ['Good.', "Mm. Don't dawdle."],
    decline: ['Mm. Later, then.', 'Metal waits. So can I.'],
    thanks: ['Good work. Honest work.', "Mm. That'll do. That'll do well."],
    about: [
      "Smith. Brannoch. That's all there is.",
      'Learned the trade in the Ironworks of Vell, far east. Big place. Loud. Everybody shouting. Here, the metal can hear itself.',
      "You've noticed the hand. Everyone does. Crucible broke in Vell. Molten copper went both ways at once, they said. Took the hand. I forged a new one. Iron and silver, phase-matched. Took me a year. Best thing I ever made. It hums when I'm happy. Don't tell anyone it hums.",
    ],
    town: "Smithy's north-west. Furnace, anvil, bench. Use them. Don't break them. Sell me ore and ingots, I pay fair.",
    qubitman: [
      "The statue was cast before my time. Bronze. Rings like no bronze I know. Two notes at once. I've tapped it. Don't tell Orla.",
      'QubitMan measured the world. I measure metal. Same idea, smaller hammer.',
    ],
    rumorIn: ['Mm. Heard something. {rumor}', "People talk at the inn. {rumor} That's all."],
    noRumor: "I don't gossip. Ask Maribel.",
    memory: ['That {item}. Still on my shelf. Good.', 'The {item}. I think of it sometimes. Mm.'],
    deeds: {
      smelt: ['You smelted something. I could smell it. Good smell.'],
      forge: ['Heard you forged a {what}. Let me see your hands. …Mm. Good calluses.'],
      perfect_forge: ["A Perfect {what}. Perfect. I've made three of those in my life. Sit down. I need a moment."],
      kill: ["You've been fighting. Your blade needs care. Come by."],
      quest: ['Heard you took care of {what}. Good.'],
    },
    barks: {
      work: ['*clang* … *clang* …', 'Mm. More heat.', 'Hmm-hm-hmmm…', 'Steady. Steady.', 'Phase is off. Again.'],
      free: ['Mm.', 'Ale. Good.', '…', 'Hm. Nice night.'],
    },
    closed: 'Forge is banked for the night. Come back at seven.',
    events: [
      {
        hearts: 2,
        title: 'The Hum',
        pages: [
          'Stand here. Quiet. Listen.',
          '*clang*',
          'Hear it? The ring after the strike. Copper rings warm. Iron rings cold. When they ring the same note, they bond.',
          'Most people only hear noise. What do you hear?',
        ],
        choices: [
          {
            text: 'A song.',
            reply: 'Mm. Yes. A song. Not everyone hears it. You can come and listen. Any time.',
            pts: 20,
          },
          {
            text: 'Two notes, almost together.',
            reply: "…You do hear it. Almost together. That's the flaw. You've got good ears. Better than mine were.",
            pts: 25,
          },
          { text: 'Mostly my ears ringing.', reply: 'Ha. Honest. Also good. Wear cotton in them next time.', pts: 10 },
        ],
      },
      {
        hearts: 5,
        title: 'The Iron Hand',
        pages: [
          "You've looked at the hand. Don't pretend. Everyone looks. It's fine.",
          "Vell. The great crucible. Someone poured copper into a mould that was already full of silver. Opposite phases. The metal couldn't decide what it was. It went everywhere at once.",
          "Lost the hand. Lost the job. Walked west for a month. Ended up here. Built a forge. Built a hand. Iron and silver, matched, so it wouldn't fight itself.",
          'It took a year. Every morning I tried again.',
        ],
        choices: [
          {
            text: "It's beautiful work.",
            reply: 'Mm. It is. …Thank you. Nobody says that. They say "sorry". I didn\'t want sorry.',
            pts: 25,
          },
          { text: 'Do you miss Vell?', reply: 'No. Vell is loud. Here the metal can hear itself. So can I.', pts: 15 },
          {
            text: 'Does it hurt?',
            reply: 'When it rains. And when someone forges badly near me. Mostly that.',
            pts: 10,
          },
        ],
      },
      {
        hearts: 8,
        title: 'Apprentice',
        pages: [
          'Sit. I made something.',
          "A hammer. Your grip. I measured it while you weren't looking. Don't ask how.",
          "In Vell, the master gives the hammer when the apprentice is ready. Nobody gave me one. I made my own. You shouldn't have to.",
          "So. Will you call yourself my apprentice? You can say no. I'll pretend I didn't ask.",
        ],
        choices: [
          {
            text: "I'd be honored, master.",
            reply: "…Mm. Don't call me master. Call me Brannoch. Like a friend. That's what apprentices are, here.",
            pts: 30,
          },
          {
            text: 'Only if you teach me the hum.',
            reply: "Ha! Deal. Hmm-hm-hmmm. Your turn. …Terrible. We'll practice.",
            pts: 25,
          },
          {
            text: "I'm not ready yet.",
            reply: "Mm. That's what I said. Keep the hammer anyway. When you're ready, you'll know.",
            pts: 15,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Maribel: innkeeper & cook. Motherly, chatty, food metaphors, hears everything.
  maribel: {
    greet: {
      morning: [
        "Morning, dear! Porridge is on, bread's nearly up. Sit!",
        "Oh good, a face! I've been talking to the dough all morning and it never answers.",
        'Up with the bread, are we? Good. The early bird gets the crust.',
      ],
      day: [
        'Sit, sit! Soup or stew? Or just the gossip?',
        "The kettle's always on. So are my ears.",
        "There's my favorite appetite! Pull up a chair.",
      ],
      evening: [
        'Supper rush! Grab a table, dear, before Brannoch takes two.',
        "Evening! The stew's been simmering since noon. Like my opinions.",
        "Come in, come in, the fire's lit and the pie is cooling. Don't touch the pie.",
      ],
      night: [
        "Late? Come in. There's always a bowl.",
        "Can't sleep either? I make cocoa for insomniacs. Don't tell anyone, they'll all start.",
      ],
    },
    again: [
      'Back for seconds? Of conversation, I mean. Food too, if you like.',
      'Yes, dear?',
      'Hungry again already? Growing adventurer.',
    ],
    chat: [
      [
        'A good stew is patience, a good pie is courage.',
        "Everyone tells their secrets to the soup. It's a good listener.",
        "Never trust a cook who doesn't taste. Or a mayor who doesn't eat.",
      ],
      [
        "I saved you the corner table. Don't tell Odo, it's technically his.",
        "You look thin. Here, have a crust. That wasn't a question.",
        "Cooking's easy: something warm, something green, and somebody to share it with.",
      ],
      [
        "Oh, you're family now. Family eats first.",
        "I made your favorite. Don't ask how I knew. Innkeepers know.",
        "You know you can always stay here, don't you? Room's upstairs. Fresh sheets. No charge for family.",
      ],
    ],
    bye: [
      'Off you go, dear! Eat something!',
      "Don't be a stranger. Strangers pay full price.",
      'Mind the step! Everybody trips on that step.',
    ],
    accept: ["Oh, you're a treasure!", "Lovely! I'll keep a bowl warm for when you're back."],
    decline: ['Of course, dear. The pot will wait.', 'No rush. Nothing good was ever rushed. Except toast.'],
    thanks: [
      "Oh, perfect! You've saved supper. Here, for your trouble.",
      "Bless you! Take this, and don't argue with a cook.",
    ],
    about: [
      'Maribel Crumb. I run The Crooked Spoon. Thirty rooms, if you count the cupboard. I count the cupboard.',
      "I trained in a duke's kitchen, down south. Very grand. Very gold. He salted every dish before he tasted it. Every single one. I lasted four years. Then I walked out mid-banquet. Best soufflé I ever made, and I left it on the counter.",
      "The spoon over my door? It was my grandmother's. She swore QubitMan stopped here for soup, looked at the spoon, and it couldn't decide whether to be straight or bent. It's been crooked ever since. I named the inn after it. Some days I think it's the only proof we have.",
    ],
    town: "Hadamere's the kind of place where people knock and then come in anyway. My inn's north of the plaza; everyone eats here eventually. The cooking pot in my kitchen is yours to use, dear.",
    qubitman: [
      "He ate here, you know. Grandmother's soup. Left a coin that was heads AND tails. Somebody spent it. Probably Tobin.",
      'ALL HAIL QUBITMAN, and pass the bread.',
    ],
    rumorIn: [
      "Ooh, sit closer. {rumor} You didn't hear it from me. You did, but you didn't.",
      'The soup told me. Well, the people eating it. {rumor}',
    ],
    noRumor: "Nothing new? That's a first. I'll check the stew, maybe it knows something.",
    memory: [
      'I cooked with your {item}! Well, I tried. It went somewhere lovely.',
      'Thank you again for the {item}, dear. My kitchen still smells of kindness.',
    ],
    deeds: {
      cook: ['You made {what}! Was it good? Of course it was good, you learned from the best. Me. I mean me.'],
      harvest: ["Fresh {what}! Bring me some if you can spare it, dear. I'll make something you'll write home about."],
      fish: ['Caught a {what}, I hear! Fish fry night!'],
      rare_fish: ['A {what}?! Oh, Sedge must be green with envy. Literally. He gets a rash.'],
      quest: ['Everyone at supper was talking about how you {what}.'],
      gift_love: ['I heard you made {what} very happy. That warms me more than the oven.'],
    },
    barks: {
      work: [
        'Stir, stir, taste… more salt.',
        'Who wants pie?',
        'Order up!',
        'Not too much thyme, not too little. Just… time.',
        'Mind the hot pot!',
      ],
      free: [
        'Carrots, leeks… oh, those are lovely.',
        'Fresh bread at six!',
        'Morning, Tobin! Your prices are criminal!',
      ],
    },
    closed: "Kitchen's closed, dear, but I'll find you a crust. Come back after six in the morning for the real thing.",
    events: [
      {
        hearts: 2,
        title: 'The Crooked Spoon',
        pages: [
          "You keep looking at the spoon over my door. Everyone does. Come, I'll tell you.",
          'My grandmother ran this kitchen before me. One night a stranger in a coat of every colour came in, soaked to the bone, and asked for soup.',
          "He ate every drop. Then he picked up her spoon and looked at it. Just looked. And the spoon couldn't make up its mind whether to be straight or bent.",
          "It's been crooked ever since. Grandmother never washed it again. Well. She washed it. Carefully.",
        ],
        choices: [
          {
            text: 'Was it QubitMan?',
            reply:
              'Who else wears a coat like that? Certainly not Pippa, though she\'s tried. Grandmother called him "a nice young man with a lantern". That\'s grandmothers for you.',
            pts: 15,
          },
          {
            text: 'Can I touch it?',
            reply:
              "Ha! Nobody touches the spoon. Odo tried once. He says it was warm. Odo doesn't exaggerate. It's very annoying.",
            pts: 10,
          },
          {
            text: 'What was the soup?',
            reply:
              "Leek and potato. I still make it on Measurement Day. You'll have a bowl. That's not a question either.",
            pts: 20,
          },
        ],
      },
      {
        hearts: 5,
        title: "The Duke's Kitchen",
        pages: [
          'I used to cook for a duke, did I tell you? Gold plates. Forty cooks. A whole room just for cheese.',
          "And every night, he'd salt every dish before he tasted it. My soups, my sauces, my perfect little soufflés. Salt, salt, salt.",
          'One night I made a soufflé so good it made a footman cry. The duke reached for the salt. I put down my spoon, took off my apron, and walked out the front door.',
          'Took me three weeks to get here. Best walk of my life.',
        ],
        choices: [
          {
            text: 'Good for you!',
            reply: "Good for me! Yes! That's what I tell myself every time I miss the cheese room.",
            pts: 20,
          },
          {
            text: 'Did you ever make that soufflé again?',
            reply: 'Once a year. For myself. With no salt shaker anywhere in the building.',
            pts: 25,
          },
          {
            text: 'I salt everything too…',
            reply: "You WHAT. …Well. At least you're honest. You may stay. Taste first, from now on. Promise me.",
            pts: 10,
          },
        ],
      },
      {
        hearts: 8,
        title: 'The Secret Ingredient',
        pages: [
          "You've been eating at my tables long enough. Time you knew.",
          "Everyone asks for my secret ingredient. Orla thinks it's nutmeg. Tobin thinks it's butter. Brannoch thinks I use magic. Brannoch is very sweet.",
          "It's attention. That's all. I watch the pot. I taste. I think about who's going to eat it. You can taste when someone was paying attention.",
          'Now you know. Go and cook for someone you love.',
        ],
        choices: [
          {
            text: "I'll cook for you, then.",
            reply: "Oh, you. Stop it. …You'd better. Thursday. Bring something green.",
            pts: 30,
          },
          {
            text: 'So it IS a little bit magic.',
            reply: "Maybe it is. Don't tell Wren, she'll want to measure it.",
            pts: 25,
          },
          {
            text: 'I was hoping for nutmeg.',
            reply: "Ha! There's nutmeg in everything too. The secret has a secret.",
            pts: 15,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Fenwick: the farmer. Folksy, slow, humble, talks to his crops.
  fenwick: {
    greet: {
      morning: [
        "Mornin'. Dew's still on the leaves. Best time to listen to them grow.",
        "Up early! You'll make a farmer yet.",
        "Mornin'. Rooster beat me again. He always does. Show-off.",
      ],
      day: [
        "Afternoon. Sun's doing half my work today.",
        "Hey there. Fields are open to anyone. Water what you plant, and it'll water you back.",
        "You planting? Good. The soil's been lonely.",
      ],
      evening: [
        'Evening. Fields are tucked in. So should I be, soon.',
        'Long day. Good day. Hands hurt in the honest way.',
      ],
      night: ['Ought to be in bed, same as I should be.', "Can't sleep. Listening for rain."],
    },
    again: ['Yep?', 'Still here. Like a scarecrow, but friendlier.', "Somethin' else?"],
    chat: [
      [
        'Water every day, or pray for rain. I do both.',
        'Crops are fussy about seasons. A turnip in summer is just sadness.',
        'Sprinklers are worth every copper. Trust me, my back says so.',
      ],
      [
        "Your turnips are looking good. Don't tell the others I peeked.",
        "Fertilizer shaves a day off a crop. Fiber and a dab of slime gel. Don't ask me who figured that out.",
        "Folks who farm always come back. Soil's sticky that way.",
      ],
      [
        "You've got the touch, friend. Not everybody does.",
        'Come help me with the barn gate? …Joking. Mostly.',
        "Pa would've liked you. He liked anybody who wasn't afraid of mud.",
      ],
    ],
    bye: ['Take care now.', 'Mind the furrows.', "See you 'round. Water your crops!"],
    accept: ['Much obliged.', "That's mighty kind. Off you go."],
    decline: ["No worries. Crops don't rush, neither do I.", "Whenever you're ready, friend."],
    thanks: ["Well I'll be. Thank you kindly.", "That's a weight off. Here, take this."],
    about: [
      'Fenwick Hartley. Farmer. Third of the Hartleys to break his back on this land, and proud of it.',
      "Pa farmed here, and his pa before him. Pa could make a stone sprout, folks said. Me, I mostly just keep things alive. Some days that's enough.",
      "Grandpa kept a box of seeds that were two seeds at once. Superposed, Wren calls 'em. He said QubitMan showed the first farmers how: \"plant both, and let the harvest choose\". I've still got the box. I've never planted one. Scared I'd waste it.",
    ],
    town: 'The community garden east of the plaza, past the fence, is free for anybody. Already tilled. I sell chickens, cows, coops and sprinklers at my farm supply.',
    qubitman: [
      "Grandpa said QubitMan taught us to plant both seeds and let the harvest choose. Wren's superposed seeds are the same trick, if you ask me.",
      'Folks hail him every morning. I hail the rain. Same thing, some days.',
    ],
    rumorIn: ['Heard a thing at the inn: {rumor}', "Don't usually pass gossip along, but: {rumor}"],
    noRumor: "Haven't heard anything. The cows don't talk much.",
    memory: [
      'That {item} you gave me? The missus— well. Me. I enjoyed it. Thank you.',
      'Still thinking about that {item}. Kind of you.',
    ],
    deeds: {
      plant: ['Saw you planting. Good straight rows. Your pa teach you that? No? Huh. Natural.'],
      harvest: ['A fine bunch of {what}! Told you the soil likes you.'],
      quest: ['Heard you {what}. Good on you.'],
      discover: ['You figured out how to make {what}? Clever. I just use what Pa used.'],
    },
    barks: {
      work: [
        'Come on, little sprout…',
        'Needs water. Everything needs water.',
        'Whoa there, crow!',
        'Hm. Gonna be a good crop.',
        '*hums a farm song*',
      ],
      free: ['Long day.', 'Smells like rain. Hope so.', 'Evening, folks.'],
    },
    closed: "Farm supply's closed for the night. Open at six, sunup.",
    events: [
      {
        hearts: 2,
        title: 'Talking to Turnips',
        pages: [
          '"…and you\'re doing great, you\'ll be the biggest one yet, just a little more sun—"',
          "Oh! Didn't see you there. I was, uh. Checking the soil.",
          "…Alright. I talk to 'em. Pa did too. He said a plant that's talked to grows tall out of politeness.",
        ],
        choices: [
          {
            text: 'I talk to mine too.',
            reply: "Ha! Knew it. You've got the look. Don't tell Tobin, he'll start charging the turnips rent.",
            pts: 20,
          },
          { text: 'Does it work?', reply: 'Biggest turnips in the valley three years running. You tell me.', pts: 15 },
          {
            text: "Your secret's safe.",
            reply: 'Appreciate it. Though I reckon half the village already knows. I talk loud.',
            pts: 10,
          },
        ],
      },
      {
        hearts: 5,
        title: "Pa's Hoe",
        pages: [
          "See that hoe on the wall? Pa's. Handle's worn to the shape of his hands.",
          'Everyone loved him. Best farmer in three valleys. When he died, the whole village came. They all said, "You\'ve got big boots to fill."',
          "I've been trying to fill 'em for ten years. Some mornings I think I'm not half the farmer he was.",
        ],
        choices: [
          {
            text: 'You keep this whole village fed.',
            reply: "…Huh. Guess I do. Didn't think of it like that. Thank you, friend. Really.",
            pts: 25,
          },
          {
            text: 'Maybe you need your own boots.',
            reply: "My own boots. Ha. Maybe I do. Maybe I'll make the handle on a new hoe fit my hands. Might be time.",
            pts: 25,
          },
          {
            text: "He'd be proud.",
            reply: "You reckon? …Yeah. Maybe. He'd tell me the fence needs fixing, first.",
            pts: 15,
          },
        ],
      },
      {
        hearts: 8,
        title: 'The Seed Box',
        pages: [
          'Come in. Wipe your boots. I want to show you something.',
          "Grandpa's seed box. Every seed in here is two seeds at once. They hum, if you hold 'em to your ear.",
          "I've never planted one. Scared I'd waste the last of something. But I've been thinking. Seeds aren't for keeping.",
          'Will you plant one with me? Come spring?',
        ],
        choices: [
          {
            text: "Let's plant it together.",
            reply: "Then it's a deal. Whatever it turns into, it'll be half yours. That's how Grandpa would want it.",
            pts: 30,
          },
          {
            text: "What do you think it'll become?",
            reply: "Grandpa said it's a pumpkin and a melon. Or a melon and a pumpkin. We'll find out when we look.",
            pts: 20,
          },
          {
            text: 'Maybe some things are for keeping.',
            reply: 'Maybe. But a seed in a box is just a promise you never keep. …Think on it with me.',
            pts: 15,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Sedge: the fisher. Laconic, dry, introvert; obsessed with the glowfin.
  sedge: {
    greet: {
      morning: ['Shh. Morning bite.', 'Morning. Fish are hungry. Me too.', '…Morning.'],
      day: ["Shh — you'll scare the fish. And me.", 'Fishing takes patience. Standing next to me takes more.', 'Hey.'],
      evening: ['Evening. Eels come out soon.', "Sun's going. Good. Fish like shade. So do I."],
      night: [
        "Night fishing. Don't tell Maribel I skipped supper.",
        "Something glows down there at night. Don't look straight at it.",
      ],
    },
    again: ['…Still here?', 'Mm.', "You're standing on my line. Not literally. Spiritually."],
    chat: [
      [
        'When the line twitches, wait for the tug. Then pull on the beat.',
        'Rain brings the big ones. Eels, catfish. Bring a coat.',
        "Deep water, bigger fish. The middle of the pond's deep.",
      ],
      [
        "You're learning the tugs. I can tell by how you stand.",
        'Catch anything worth lying about yet?',
        'Koi come up shallow on spring mornings. Pike bite in autumn.',
      ],
      [
        "You're the only one who doesn't talk during a bite. I appreciate that.",
        "Stay. The pond's better with two of us.",
        "I'd share my spot with you. That's… a lot, for me.",
      ],
    ],
    bye: ['Tight lines.', 'Mm. Bye.', 'Go quietly.'],
    accept: ['Good.', "Mm. Don't rush the fish."],
    decline: ['Fine.', "Fish'll wait."],
    thanks: ['Good catch. Here.', 'Mm. Not bad. Not bad at all.'],
    about: [
      'Sedge. I fish.',
      "Used to sail. Big boats, salt water, fish the size of carts. Came inland. Ponds don't try to drown you. Usually.",
      "My brother sailed too. Didn't come back from the Narrows. Six years. Water's where I feel him. So I sit by it. That's all. That's the whole story.",
    ],
    town: "Pond's south of the plaza. Deep in the middle. I buy fish and bugs. Bugs make bait. Bait makes fish. Fish make money. Money makes… more bait.",
    qubitman: [
      "The glowfin? QubitMan's lantern. Dropped it in the pond. That's my theory. Everyone laughs. I don't care.",
      "You can only see the glowfin when you're not looking for it. Sounds like him.",
    ],
    rumorIn: ['…Heard something. {rumor}', 'People talk by the water. {rumor}'],
    noRumor: 'No news. Good.',
    memory: ['That {item}… kept it. Thanks.', "Still got that {item}. Don't make it weird."],
    deeds: {
      fish: ['You caught a {what}. Saw the ripples.'],
      rare_fish: ['A {what}. …Huh. Took me two years. Show me your cast sometime.'],
      bug: ['Caught a {what}? Good bait. Or good company. Depends on the bug.'],
      quest: ['Heard you {what}. Good.'],
    },
    barks: {
      work: ['…', 'Bite. No. Never mind.', 'Shh.', 'Come on, glowfin…', '*yawns*'],
      free: ['Fish fry, please.', '…', 'Smells like rain. Good.'],
    },
    closed: "Tackle's packed for the night. Come back at dawn.",
    events: [
      {
        hearts: 2,
        title: 'Quiet Company',
        pages: ['Sit. If you want.', '…', '…', '…Most people talk by now.'],
        choices: [
          { text: '(Keep watching the water.)', reply: '…Good. You can come back. Any time.', pts: 25 },
          {
            text: "It's peaceful here.",
            reply: "Mm. It is. Was. Now it's peaceful with talking. Still good.",
            pts: 15,
          },
          { text: 'Caught anything?', reply: "Not yet. That's the fun part.", pts: 10 },
        ],
      },
      {
        hearts: 5,
        title: 'The Glowfin Theory',
        pages: [
          "You want to hear my theory. Nobody does. You're going to anyway.",
          "The glowfin isn't a fish. It's a light that's also a fish. When you look right at it, it chooses: fish, or nothing. Usually nothing.",
          "I think it's QubitMan's lantern. Fell in the pond, years back. Still deciding what to be.",
          'Go on. Laugh.',
        ],
        choices: [
          {
            text: 'I believe you.',
            reply:
              "…Nobody's said that. Ever. …Thanks. If you catch it, don't tell me. I want to catch it myself. But tell me.",
            pts: 30,
          },
          {
            text: 'How would you catch it, then?',
            reply:
              "Don't look at it. Look at the water next to it. Wait till night, in summer. I've almost had it twice.",
            pts: 20,
          },
          { text: '(Laugh.)', reply: "Mm. Everyone does. One day I'll laugh back with a glowfin in my hand.", pts: 5 },
        ],
      },
      {
        hearts: 8,
        title: 'The Narrows',
        pages: [
          "My brother. Ash. He was the talker. I was the quiet one. He'd say I fished so I didn't have to answer questions.",
          "He sailed the Narrows six years ago. Storm. Ship came back. He didn't.",
          "I came inland. I sit by the water because it's the last place he was. Silly.",
          "You're the first person I've told. Don't know why. You're good at quiet.",
        ],
        choices: [
          {
            text: "It isn't silly. It's love.",
            reply: '…Yeah. Maybe it is. …Thanks. For listening. For quiet.',
            pts: 30,
          },
          {
            text: 'Tell me about Ash.',
            reply:
              "He laughed too loud. Couldn't tie a knot to save his life. Best brother. …He'd have liked you. He liked everyone. I'm working on it.",
            pts: 25,
          },
          { text: '(Sit beside him in silence.)', reply: '…', pts: 20 },
        ],
      },
    ],
  },

  // ───────────────────────────── Wren: herbalist & alchemist. Curious, excitable, probability-minded, ex-academic.
  wren: {
    greet: {
      morning: [
        "Oh! Morning! I've been up all night. Or no night at all. Hard to tell.",
        'Good morning! The dew has a 74% chance of being lovely today.',
        "Morning! Don't mind the fumes. They're mostly harmless. Mostly.",
      ],
      day: [
        "Don't mind the fumes. They're mostly harmless.",
        "You smell like fresh air. That's rare around here.",
        "Ah, a visitor! Quick, think of a number. Don't tell me. Good. It's collapsed now.",
      ],
      evening: [
        'Evening! Prime stargazing hours. The sky is just a big probability chart.',
        'Oh, is it evening? I lost a whole afternoon to a mushroom.',
      ],
      night: [
        'The stars are out. You can see the whole circuit of them.',
        "Shh, I'm observing. Not you. Them. Up there.",
      ],
    },
    again: [
      'Yes? Ask me something! Questions are my favorite food.',
      'Back again! That increases the likelihood you like me. Statistically.',
      "Mm? Sorry, I was halfway through a thought. It's still there. Hovering.",
    ],
    chat: [
      [
        'Mix two seeds with a qubit crystal. At harvest the plant picks which one it was. Tonics tilt the odds.',
        'A good potion is just a patient question.',
        'Healing herbs grow in spring and summer. Slime gel binds them. Three herbs, one gel: healing potion.',
      ],
      [
        "You're the kind who asks good questions. Ask me one.",
        "Experiment at a station! If the ingredients are right but the amounts are wrong, the mix fizzes. That's a clue!",
        'Everything is a superposition until somebody cares enough to look.',
      ],
      [
        "You noticed it too: a plant can be two plants until it's picked. We should talk about this more.",
        "You're a friend of the experiment. Welcome.",
        "I've started writing your name in my notebook margins. As a variable. That's a compliment.",
      ],
    ],
    bye: ['Go observe something!', "Bye! Don't collapse anything important.", 'Farewell! Probably. Possibly. Yes.'],
    accept: ['Wonderful! A new experiment begins!', "Oh, excellent. Hypothesis: you'll succeed."],
    decline: ['Fine! Uncertainty is valuable too.', 'The question stays open. Open questions are the best kind.'],
    thanks: ['It works! It works! Here, a reward, for science.', 'Splendid data. Splendid you. Here.'],
    about: [
      'Wren Thistle. Herbalist. Alchemist. Professional asker of questions nobody wanted asked.',
      'I studied at the Academy at Kettering. Briefly. They expelled me for an "unobserved experiment". I left a sealed box in the lab overnight, and in the morning there were two labs. Well. The paperwork said two. The building said one. Nobody could agree.',
      "My real hypothesis? QubitMan wasn't a man. He was a measurement. The moment everyone in the valley looked at the same thing at once and agreed on it. We made him a statue because you can't put a moment on a plinth. …Don't tell Orla. She'd be devastated. Or delighted. Both, probably.",
    ],
    town: 'Hadamere sits on very interesting ground. The flux is high here; things like to be two things. My house is south-west, with an alchemy table you\'re welcome to use. Mind the jar labelled "maybe".',
    qubitman: [
      "ALL HAIL QUBITMAN! Ha. You know he never collapsed into one shape? The statue had to be cast in two moulds at once. Brannoch won't confirm it. He won't deny it either.",
      "He measured the world, and the world chose to be. Best sentence ever carved into bronze. I'd have added a footnote.",
    ],
    rumorIn: ['Data point! {rumor}', 'Unconfirmed report: {rumor} Probability of truth: decent.'],
    noRumor: 'No new data. Suspicious. Something is definitely happening somewhere.',
    memory: [
      'I measured your {item}. Then I used it. Then I wrote about it. Then I measured it again. Thank you!',
      "That {item}! It's in my notes. Page 212. With a little heart. Scientifically drawn.",
    ],
    deeds: {
      discover: ['You discovered {what}?! By experimenting? Oh, I knew you had the spirit of inquiry!'],
      harvest: ['You harvested {what}. Did it collapse cleanly? Tell me everything.'],
      bug: ['A {what}! May I… observe it later? Respectfully.'],
      quest: ['I heard you {what}. Fascinating!'],
      statue: ['You read the plaque! "The world chose to be." Doesn\'t it give you shivers? Good shivers.'],
    },
    barks: {
      work: [
        'Bubble, bubble… hmm, not that bubble.',
        'Note to self: do not taste the blue one.',
        'Two seeds, one crystal…',
        'Fascinating!',
        "It's fizzing. Fizzing is good. Probably.",
      ],
      free: ['Look at the stars!', 'Hm, a 40% chance of rain. I like those odds.', 'That cloud is two clouds.'],
    },
    closed: 'The lab is closed for the night. Come back at seven, and bring questions.',
    events: [
      {
        hearts: 2,
        title: 'The Notebook',
        pages: [
          'Look, look! My notebook. Every mushroom in the south meadow, every morning, for two years.',
          'You see? On days when someone walks by, they grow straighter. On days when nobody comes, they grow in two directions at once.',
          'Either mushrooms are shy, or being seen changes things. I have a theory. I always have a theory.',
        ],
        choices: [
          {
            text: 'Being seen changes things.',
            reply:
              'Yes! YES. You get it. I\'m writing this down: "subject agrees". You\'re the subject. Hello, subject.',
            pts: 20,
          },
          {
            text: 'Mushrooms are shy.',
            reply: "Ha! That's the other theory. Equally supported. You're funny. Writing that down too.",
            pts: 15,
          },
          {
            text: 'You spent two years on mushrooms?',
            reply: 'Two years, four months and a fortnight. Well spent! Probably. I have a chart.',
            pts: 10,
          },
        ],
      },
      {
        hearts: 5,
        title: 'Expelled',
        pages: [
          "You want to know why I left Kettering? Sit. Mind the jar. No, the other jar. That one's fine.",
          'I put a seed, a crystal and a candle in a sealed box and left it overnight. Unobserved. That was the whole experiment: what happens when nobody looks?',
          'In the morning the lab was two labs. Or the paperwork said so. The dean said I\'d "destabilised the faculty". I said they were always unstable.',
          "They asked me to leave. I came here, because Hadamere is the one place where nobody thinks I'm strange.",
        ],
        choices: [
          {
            text: 'Their loss.',
            reply:
              "That's what I tell myself on Tuesdays! On the other days I tell myself the lab is still two labs and they just haven't noticed.",
            pts: 20,
          },
          {
            text: 'What was in the box in the morning?',
            reply:
              'A seed that was two seeds. The very first superposed seed. I planted it here. It became the herb garden behind my house. Both of them.',
            pts: 25,
          },
          {
            text: 'You ARE a bit strange.',
            reply: 'Ha! Yes. Strange is just a word for "not measured yet". Thank you!',
            pts: 10,
          },
        ],
      },
      {
        hearts: 8,
        title: 'The Real Experiment',
        pages: [
          "I've never told anyone my real hypothesis. Not properly. Can I tell you?",
          "I don't think QubitMan was a man. I think he was the moment when everyone here looked at the same world and agreed it was real. A shared measurement.",
          'And I think it happens again, smaller, every time people trust each other. Every friendship is a little measurement. You looked at me and decided I was worth knowing.',
          "That's… quite a lot to say out loud. I'll stop now.",
        ],
        choices: [
          {
            text: "Then I'm glad I measured you.",
            reply:
              "…Oh. Oh, that's the nicest thing anyone has ever said in my lab. I'm going to need a moment. And a tonic.",
            pts: 30,
          },
          {
            text: "So we're all a little bit QubitMan.",
            reply: "Exactly! ALL HAIL US! Don't tell Orla I said that. She'd put it on a banner.",
            pts: 25,
          },
          {
            text: "That's a lot of theory.",
            reply: "It is! But it's my favorite one. You can disagree. Disagreement is just another measurement.",
            pts: 15,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Pippa: the tailor. Stylish, dramatic, "darling", big heart under the flair.
  pippa: {
    greet: {
      morning: [
        'Morning, darling! Oh. That outfit. Before coffee. Brave.',
        "Good morning! I'm wearing yellow today, it's an optimistic sort of day.",
        "Darling! Turn around. Mm. We'll work on it.",
      ],
      day: [
        "Oh, that coat. We'll fix that. Gently.",
        "Everything's better with a little color.",
        "Darling, you're just in time to tell me which blue is bluer.",
      ],
      evening: [
        'Evening, darling! The light is gorgeous. Stand there. No, there. Perfect.',
        'People-watching hour! Odo just walked by in two different socks. Iconic.',
      ],
      night: ['Candlelit sewing is the best sewing.', "Up late? Me too. Inspiration doesn't keep hours."],
    },
    again: [
      "Darling, again! You simply can't stay away. Understandable.",
      "Yes, yes? I'm listening, I'm just also hemming.",
      'Back! Did you change something? No? Pity.',
    ],
    chat: [
      [
        "A dye is just a plant's secret, told on cloth.",
        "I've got some threads that shift when you're not looking.",
        'Clothes are the first thing people remember. And the last thing, if you do it right.',
      ],
      [
        "You've got an eye for colors now, I can tell.",
        'Come by the loom later, I have an idea for you. It involves sleeves. Dramatic ones.',
        'Blackberries make red dye, crocus violet, sunpetal gold. Cloth plus dye on a loom. Experiment, darling!',
      ],
      [
        "You wear everything well. It's infuriating.",
        'My best work was always for friends.',
        "If I ever do a collection, you're modelling it. I've already decided. You've no say.",
      ],
    ],
    bye: ['Ciao, darling!', 'Off you go! Stand up straight!', 'Bye-bye! Change your socks!'],
    accept: ["Marvelous! You're an angel. A practical angel.", 'Fabulous. I knew you had taste.'],
    decline: ["Oh, fine, fine. I'll sulk tastefully.", 'Of course, darling. Fashion waits for no one, but I do.'],
    thanks: ["Divine! You're a lifesaver. Here, take this.", 'Oh, perfect! Kisses! Figurative ones. Here.'],
    about: [
      "Pippa Loomis, of Loomis & Daughter. I'm the Daughter. The Loomis is my mother. She's retired. She's still the Loomis.",
      'Mother ran this shop for forty years. People came from three valleys for her coats. She moved to the coast last spring and left me the loom and a note: "Don\'t be me. Be better." No pressure, darling!',
      "I'm secretly making a coat. QubitMan's coat, from the legend: every colour at once. Every time I finish it, it looks like one colour. I unpick it and start again. I've unpicked it eleven times. I think the trick is that someone has to be wearing it.",
    ],
    town: "Hadamere has impeccable bones and dreadful curtains. My shop's east of the plaza. I buy cloth and outfits and pretty flowers. My loom is open to anyone who promises to use colour.",
    qubitman: [
      'His coat was every colour at once! The statue is bronze, which is frankly a crime against fashion.',
      'ALL HAIL QUBITMAN, the best-dressed man in the history of the valley. Allegedly. Nobody can agree what colour.',
    ],
    rumorIn: ['Oh, darling, have you heard? {rumor}', 'Tea, darling. Spilled. {rumor}'],
    noRumor: "No gossip? Darling, that's the real scandal.",
    memory: [
      'I made a ribbon out of your {item}. Well, it inspired a ribbon. Thank you, darling!',
      'Still thinking about that {item}. The colour! The texture! The thought!',
    ],
    deeds: {
      quest: ['Darling, I heard you {what}! Heroic. And in that outfit!'],
      discover: ['You invented {what}?! Creative! I adore creative.'],
      harvest: ["Fresh {what}! You've got that glow. Farming suits you. Mud doesn't."],
      gift_love: ["Everyone's talking about how you made {what} smile. Kindness is the best accessory."],
    },
    barks: {
      work: [
        'Snip, snip.',
        'Too much beige. Far too much beige.',
        'Ooh, that thread.',
        'Mm, a little more drama in the sleeve.',
        'Where are my pins? WHERE.',
      ],
      free: ['Love the hat, Fenwick! …Never mind.', 'Darling!', 'That sunset is wearing my colours.'],
    },
    closed: 'The shop is closed, darling, but my opinions are always open. Come back at eight!',
    events: [
      {
        hearts: 2,
        title: 'Measuring Up',
        pages: [
          'Darling, stand still. Arms out. No, OUT.',
          'Shoulders… hm. Sleeves… hmm. Inseam… oh my.',
          "Fascinating. Every time I measure you, I get a different number. You're a superposition of sizes. I'll have to make you something that fits all of them.",
        ],
        choices: [
          {
            text: 'Is that a problem?',
            reply:
              "A problem? Darling, it's a CHALLENGE. My favorite kind. I'll design something adjustable. Revolutionary!",
            pts: 20,
          },
          {
            text: 'Maybe stop measuring.',
            reply: "Stop measuring? Then how would anything fit? …Oh. Oh, that's deep. Wren's been talking to you.",
            pts: 15,
          },
          { text: 'Make it purple.', reply: 'PURPLE. Yes. Bold. Correct. You have hidden depths, darling.', pts: 10 },
        ],
      },
      {
        hearts: 5,
        title: 'Loomis & Daughter',
        pages: [
          'You know the sign? "Loomis & Daughter". Mother painted the "& Daughter" the day I was born.',
          'She left last spring. To the coast, to "finally sit down". She left me a note on the loom: "Don\'t be me. Be better."',
          "Every coat I make, I hold it up and think: would she have done it better? The answer is usually yes. Darling, it's exhausting being a daughter.",
        ],
        choices: [
          {
            text: 'She meant: be yourself.',
            reply: "…Oh. Oh, I hadn't— she did, didn't she. Don't make me cry on the silk, darling, it spots.",
            pts: 25,
          },
          {
            text: 'Your coats are wonderful.',
            reply: "You're sweet. Wrong, but sweet. …Fine. Maybe a little right.",
            pts: 15,
          },
          {
            text: 'Write to her.',
            reply: "I should, shouldn't I. With a sketch. She'll send back corrections. She'll love it.",
            pts: 20,
          },
        ],
      },
      {
        hearts: 8,
        title: 'The Coat of Many Phases',
        pages: [
          "I'm going to show you something nobody has seen. Close your eyes. …Open!",
          "QubitMan's coat. From the legend. Every colour at once. I've unpicked it eleven times. It always looks like just one colour when it's on the stand.",
          "I think the trick is that someone has to wear it. A coat isn't finished until somebody lives in it.",
          'Would you try it on? Just for a moment?',
        ],
        choices: [
          {
            text: '(Put on the coat.)',
            reply:
              "Oh. Oh, darling. Look. It's… every colour. Because you're in it. I knew it. I KNEW it. Don't move. I need to remember this forever.",
            pts: 30,
          },
          {
            text: "It's too precious.",
            reply:
              "That's exactly why it's yours to try. Precious things are for the people who think they're too precious. Go on.",
            pts: 20,
          },
          {
            text: 'You should wear it.',
            reply: "Me? …I've never once tried on my own work. Isn't that silly? …Maybe. Maybe on Measurement Day.",
            pts: 25,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Odo: the carpenter. Gruff, sarcastic, kind; renovates out of spite; soft for Juniper.
  odo: {
    greet: {
      morning: [
        'Mm. Morning. Mind the sawdust.',
        "You're up. Grab a plank or grab a coffee. Not both, you'll spill.",
        "Morning. Don't lean on that. It's drying.",
      ],
      day: ['Mind the sawdust. And the saw.', 'You need something built, or just ambling?', 'What.'],
      evening: ["Shop's shut. I'm not. Barely.", "Evening. Sit on the porch. It's solid. I made it."],
      night: ['Quiet shop, quiet mind.', "Can't sleep? Count planks. Works for me."],
    },
    again: ['Still here?', 'What now.', "Hm? Make it quick, glue's setting."],
    chat: [
      [
        'Measure twice, cut once, swear thrice.',
        "A coop needs planks and hay. Don't skimp on the roof.",
        "Planks come from wood, two to one, at a workbench. I shouldn't have to tell you that.",
      ],
      [
        "Back for more wood, eh? Good. I've got a surplus.",
        "You've got hands. Good. Not everyone does.",
        "The town hall roof leaked for six years. I fixed it out of spite. Then the inn's. Spite builds a lot of roofs.",
      ],
      [
        "You'd make a decent carpenter. Don't let it go to your head.",
        "Come on, hold this beam. I'll tell you a story about it.",
        "Fine. You're my friend. Happy? Don't tell anybody. I have a reputation.",
      ],
    ],
    bye: ['Hm. Bye.', 'Go on. Shoo.', "Don't trip on the planks."],
    accept: ["Good. Don't make me regret it.", 'Hm. Fine. Go.'],
    decline: ['Suit yourself.', "Fine. Wood'll wait. I won't. But the wood will."],
    thanks: ['Hm. Good work. Here.', "…Thanks. Don't make it a thing."],
    about: [
      "Odo Plank. Carpenter. Yes, that's my real name. No, I don't want to talk about it.",
      'Built half this village. Rebuilt the other half. Every time somebody says "that\'s good enough", I come back at night and make it better. Out of spite. Spite and good joinery.',
      "My grandfather carved the plinth under the statue. There's a line he carved on the back, where nobody looks. \"He'll be back. Or he never left.\" I re-carve it every spring so it doesn't wear away. Don't tell Orla. She'd make it a ceremony.",
    ],
    town: "Carpenter's house is north-east. I sell planks, furniture, and the bench you need to make your own. Built most of the town. Fixed the rest. You're welcome.",
    qubitman: [
      "Grandpa carved the plinth. Good oak. Don't sit on it.",
      'Everybody hails him. I just keep his base level. Somebody has to.',
    ],
    rumorIn: [
      "Hm. Maribel told me, so it's true, and also exaggerated: {rumor}",
      "Heard it at the inn. {rumor} Don't care. Telling you anyway.",
    ],
    noRumor: "Don't know, don't care. Ask Maribel.",
    memory: [
      "That {item}… yeah. Thanks. Still got it. Don't make it a thing.",
      "Hm. The {item}. Was good. That's all.",
    ],
    deeds: {
      quest: ['Heard you {what}. Hm. Not bad.'],
      cook: ['You can cook too? Show-off.'],
      discover: ['Figured out {what} on your own? Hm. Clever hands.'],
      kill: ["Beating up slimes now? Leave Gerald alone or Juniper'll never forgive you. Or me."],
    },
    barks: {
      work: ['*saw saw saw*', 'Hm. Crooked. Again.', 'Who moved my pencil.', 'Measure twice…', '*tap tap tap*'],
      free: ['Hm.', "Pond's nice tonight. Don't tell anyone I said nice.", "Where's that kid got to now…"],
    },
    closed: "Shop's closed. Come back at seven. Or don't. I'll be here regardless.",
    events: [
      {
        hearts: 2,
        title: 'Spite Renovations',
        pages: [
          "You're wondering why I'm on the inn roof at midnight with a lantern.",
          'Maribel had it patched by some traveler. "Good enough," she said. Good enough. GOOD ENOUGH.',
          "So I'm fixing it. Properly. Out of spite. She'll never know. That's the beauty of it.",
        ],
        choices: [
          {
            text: "That's actually really kind.",
            reply: "It's SPITE. …It's a little bit kind. Hand me that nail and don't tell anyone.",
            pts: 20,
          },
          { text: 'Need a hand?', reply: "…Fine. Hold the lantern. Higher. Higher. Good. You're useful.", pts: 25 },
          {
            text: "She'll notice.",
            reply: "She won't. She never looks up. Nobody looks up. That's where all the good work is.",
            pts: 10,
          },
        ],
      },
      {
        hearts: 5,
        title: 'The Treehouse',
        pages: [
          "You didn't see this.",
          "It's a treehouse. For the kid. Juniper. Her mum's off mapping the wilds and the kid needs somewhere to be loud.",
          'I told her no. Treehouses are dangerous. Then I built the safest treehouse in the history of trees. Rails. Double-joined. A little window that opens.',
          'She can\'t know it was me. I\'ll leave it for her to "find".',
        ],
        choices: [
          {
            text: "You're a big softie, Odo.",
            reply: "Say that again and I'll build you a very small, very uncomfortable chair. …Yeah. Maybe I am.",
            pts: 25,
          },
          {
            text: "She'll love it.",
            reply: "She'd better. Took me three weeks. And all my good oak. …She will, won't she.",
            pts: 20,
          },
          { text: 'Can I help paint it?', reply: "Hm. Blue. She likes blue. Don't get it on the rails.", pts: 15 },
        ],
      },
      {
        hearts: 8,
        title: 'The Back of the Plinth',
        pages: [
          'Come here. Behind the statue. Crouch down. Mind your knees.',
          'See that? My grandfather carved it. On the back, where nobody looks: "He\'ll be back. Or he never left."',
          "Every spring I re-cut the letters so the rain doesn't take them. Forty years. Nobody knows.",
          "Except you, now. Figured somebody should. In case I'm not here someday.",
        ],
        choices: [
          {
            text: "I'll keep it carved. I promise.",
            reply: "…Good. That's good. Use a fine chisel. Not that one. The fine one. I'll show you.",
            pts: 30,
          },
          {
            text: 'Which do you think it is?',
            reply:
              "Back, or never left? …Never left, I reckon. Look at this place. Somebody's still keeping an eye on it.",
            pts: 25,
          },
          {
            text: "You're not going anywhere.",
            reply: 'Hm. No. Too much spite left in me. Still. Now you know.',
            pts: 20,
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Juniper: young scout, eleven. Fearless, LOUD, makes up rules, believes in everything.
  juniper: {
    greet: {
      morning: [
        "MORNING! Did you see the sunrise? I saw the sunrise. It was orange. I'm reporting it.",
        "Hi hi hi! I've been awake for HOURS. Two. Two hours.",
        "Good morning, adventurer! That's you. You're the adventurer.",
      ],
      day: [
        'Hi! Are you an adventurer? You look like an adventurer.',
        'Did you see the slimes by the road? I named one Gerald.',
        "Hi! I'm on a secret mission. Can't tell you. It's about bugs.",
      ],
      evening: [
        "It's almost rumor time! I collect them. Like bugs, but words.",
        "Evening! I'm not tired. Not even a little.",
      ],
      night: ["I'm not tired. You're tired.", "Shhh. I'm waiting for QubitMan. He comes at night. Probably."],
    },
    again: [
      "You're back! Did you miss me? You missed me.",
      'What? What what what?',
      "Hi again! That's two hi's! Three if you count this one!",
    ],
    chat: [
      [
        'Nobody believes me about the glowing fish. I saw it. It was glowing.',
        'Wanna catch bugs? I know where the butterflies hang out.',
        'Rule number one of scouting: always look under things. Rule number two: wash your hands after.',
      ],
      [
        "You're my friend, right? Friends tell each other secrets.",
        "I found a spot with the BEST flowers. Maybe I'll show you.",
        "Odo says he hates kids. He made me a bug jar with a little door. I think he's lying.",
      ],
      [
        "You're the coolest. Don't tell Mayor Orla I said that.",
        'You want to hear a rumor? I have so many!',
        "When I grow up I'm going to map the whole Eigenlands. Like Mum. And you can come. You'll carry the snacks.",
      ],
    ],
    bye: [
      'BYE! See you later, alligator!',
      "Bye! Don't step on any bugs!",
      "Bye! Adventure safely! That's an order! From me!",
    ],
    accept: ["YES! You're the best!", "Deal! Pinky promise! I've decided we pinky promised."],
    decline: [
      'Awww. Okay. Later! Later is a promise!',
      "Fine. I'll ask Gerald. Gerald never says no. Gerald can't talk.",
    ],
    thanks: [
      "WOW! You did it! Here! It's my treasure! Well, some of it!",
      "YAY! You're officially an honorary scout! There's no badge. I'll draw you one.",
    ],
    about: [
      "I'm Juniper! I'm eleven! I'm a scout! Of the wilds! It's an official title. I made it.",
      "My mum makes maps. Of the WHOLE Eigenlands. She's out there right now, mapping. She writes me letters every new moon. Everyone in the village looks after me while she's gone. Even Odo. Especially Odo.",
      'I saw him. QubitMan. On the plaza, at night, when I was supposed to be asleep. He was standing next to his statue, looking at it, like he was checking it was still him. He winked at me. Nobody believes me. Do you?',
    ],
    town: 'Hadamere is the BEST! There\'s a pond with a glowing fish, a statue of a hero, and a smithy where Brannoch lets me hold the bellows. Sometimes. Once. The request board has jobs! I put one up once. It said "need snacks". Nobody did it.',
    qubitman: [
      'ALL HAIL QUBITMAN! I say it the loudest. I practise.',
      'I saw him once! At night! He winked! He was kind of glowing! Or two of him! It was dark!',
    ],
    rumorIn: ['Okay okay okay, listen: {rumor}', "I heard a RUMOR! {rumor} I'm a professional."],
    noRumor: "No rumors today! I'll make one up. …No, Mayor Orla said I'm not allowed anymore.",
    memory: [
      "I still have the {item} you gave me! It's in my treasure box! With Gerald's rock!",
      'Remember the {item}? BEST present. I told everyone.',
    ],
    deeds: {
      bug: ['You caught a {what}?! Show me! SHOW ME!'],
      kill: ["Did you bonk a slime? Was it Gerald? Promise it wasn't Gerald!"],
      rare_fish: ['You caught a {what}?! Was it glowing? Was it the glowing one? Was it?!'],
      statue: ['You read the statue! Did he wink? He winks sometimes. Only at night.'],
      quest: ["Everyone says you {what}! You're like a real hero! Like QubitMan but less glowing!"],
    },
    barks: {
      work: ['Hiii!', 'Look, a bug!', 'Gerald, no!', "I'm a SCOUT!", "Tag! You're it!", 'ALL HAIL QUBITMAN!'],
      free: ['Psst! Rumor time!', "I'm not sleepy.", 'Did you know frogs can— never mind.'],
    },
    closed: "I don't have a shop! I have a treasure box. It's closed. It's a secret.",
    events: [
      {
        hearts: 2,
        title: 'Meet Gerald',
        pages: [
          'Okay. Okay okay okay. Close your eyes. No peeking!',
          '…OPEN! This is Gerald!',
          "…He's a slime. A little one. He lives in the flowers by the road. He's NICE. He doesn't wobble at people. He wobbles at me because we're friends.",
          'Say hello to Gerald!',
        ],
        choices: [
          {
            text: 'Hello, Gerald!',
            reply:
              "He likes you! He's wobbling! That's a happy wobble! You're officially friends with Gerald now. That's really rare.",
            pts: 20,
          },
          {
            text: 'Is that safe?',
            reply: "Gerald is the SAFEST. Safer than Odo's saw. Odo's saw is very scary.",
            pts: 10,
          },
          {
            text: '(Wobble back at Gerald.)',
            reply: 'HAHA! You speak wobble! I KNEW IT. Nobody else speaks wobble!',
            pts: 25,
          },
        ],
      },
      {
        hearts: 5,
        title: "Mum's Letter",
        pages: [
          'A letter came! From Mum! Will you read it with me? I can read. I just like it when someone else reads it too.',
          '"Dear Junebug. I\'m on the edge of the Crystal Flats. The hills here are two hills at once, and they argue about it at night. I\'ve drawn you a map. Look after Hadamere for me."',
          '"P.S. Tell Odo thank you for the bug jar. I know it was him."',
          "…She's been gone since autumn. It's fine. I'm fine. I'm looking after Hadamere.",
        ],
        choices: [
          {
            text: "You're doing a great job.",
            reply: "I AM, aren't I? I counted all the benches. Twice. …Thanks. I'll tell her you said so.",
            pts: 25,
          },
          {
            text: "It's okay to miss her.",
            reply: "…Yeah. I miss her a lot. But it's okay. She comes back. People come back. Mostly.",
            pts: 25,
          },
          {
            text: 'Two hills at once? Cool!',
            reply: "RIGHT?! When I'm big I'm going to go there and see them argue!",
            pts: 15,
          },
        ],
      },
      {
        hearts: 8,
        title: 'I Saw Him',
        pages: [
          "I need to tell you something important and you can't laugh. Promise. Pinky promise. Okay.",
          "Last winter I snuck out at night. I wasn't supposed to. And there was a man standing next to the statue. In a coat that was every colour. Looking up at it like he was checking it was still him.",
          "He turned around and saw me. And he winked. And then I blinked and he wasn't there. Or he was and I couldn't see him anymore.",
          'Nobody believes me. Do you believe me?',
        ],
        choices: [
          {
            text: 'I believe you.',
            reply:
              "…REALLY? You really really do? …I knew you would. You're my best grown-up. Officially. I'm writing it on the board.",
            pts: 30,
          },
          {
            text: 'What did he look like?',
            reply:
              'Kind. Tired. Like Mum when she comes home. And sort of see-through at the edges. Like a dream you remember.',
            pts: 25,
          },
          {
            text: 'Maybe it was a dream.',
            reply: "Maybe. But dreams don't wink. …Okay, maybe they do. But I still believe it.",
            pts: 10,
          },
        ],
      },
    ],
  },
};

for (const n of NPCS.filter((n) => n.settlement)) {
  const first = n.name.split(' ')[0]!,
    home = n.settlement!;
  V[n.id] = {
    greet: {
      morning: [`Morning. ${first}, at your service. The harbour is waking.`],
      day: [`Welcome back. How was the crossing to ${home}?`],
      evening: ['Come watch the last boats tie up.'],
      night: ['Keep to the lanterns tonight.'],
    },
    again: ['A little more time together? Gladly.'],
    chat: [
      [n.bio, `My work as ${n.title.toLowerCase()} takes patience. The sea teaches that.`],
      ['You have learned the quay by heart now.', 'Tell me something you found beyond the home coast.'],
      ['There is always room for you at my table.', `You helped ${home} feel like home. I remember that.`],
    ],
    bye: ['Fair winds. Come home safely.'],
    accept: ['I knew I could trust you with this.'],
    decline: ['Another day, then. No hard feelings.'],
    thanks: ['You kept your word. Thank you.'],
    about: [
      n.bio,
      `${n.bio} My first crossing was terrifying. I counted the lanterns until dawn.`,
      'I used to think belonging meant never leaving. You taught me that coming back matters just as much.',
    ],
    town: `${home} lives by its harbour. Houses open onto the market streets; the boardwalk leads to the quay. Hadamere lies across the sea.`,
    qubitman: [
      'They say QubitMan raised a light that could be seen from both shores at once. A comforting thought on a dark crossing.',
    ],
    rumorIn: ['Word from the quay: {rumor}'],
    noRumor: 'Only weather talk today.',
    memory: ['I still remember the {item} you brought me.'],
    deeds: {
      fish: ['A catch of {what}? The harbour will hear of that.'],
      quest: ['People remember a promise kept.'],
      rare_fish: ['{what}! That is a story for a long winter night.'],
    },
    barks: {
      work: [`Another day as ${n.title.toLowerCase()}.`, 'Mind the ropes.', 'These hands know their work.'],
      free: ['Salt in the air.', 'The tide is turning.', 'A cup before the next boat.'],
    },
    closed: 'The counter opens at nine. Come find me then.',
    events: [2, 4, 7].map((hearts, i) => ({
      hearts,
      title: `${first}: ${['A lantern kept', 'The first crossing', 'A place at the table'][i]}`,
      pages: [
        n.bio,
        [
          `${first} sets a small lantern on the quay. “My family left this light burning for every returning boat.”`,
          `“On my first crossing I was certain the water would swallow us. Someone shared their coat and told me stories until morning.”`,
          `A spare cup waits beside ${first}'s own. “I set this out before I knew you were coming. I hoped.”`,
        ][i]!,
        [
          '“Will you help me keep it lit?”',
          '“What do you carry with you when you are afraid?”',
          '“Stay a little. The sea will still be there tomorrow.”',
        ][i]!,
      ],
      choices: [
        { text: 'I will make time for this.', reply: 'Then let us start with a cup together.', pts: 20 },
        { text: 'Tell me more.', reply: 'There is a long story behind that light. Walk with me.', pts: 10 },
        { text: 'I should keep moving.', reply: 'Of course. Take a little light for the road.', pts: 0 },
      ],
    })),
  };
}

export const VOICES: Readonly<Record<string, Voice>> = V;
export const voiceOf = (npcId: string): Voice | undefined => V[npcId];

// ───────────────────────── QubitMan ─────────────────────────

/** The statue in the plaza. Reading it shows the plaque and the legend (pages). */
export const QUBITMAN = {
  title: 'The Statue of QubitMan',
  plaque: 'ALL HAIL QUBITMAN',
  epitaph: 'He measured the world, and the world chose to be.\nErected by the grateful people of Hadamere.',
  legend: [
    'Before there was a Hadamere, the valley was unmeasured. Every hill was also a hollow. The river ran north and south at once. Seeds were ripe and rotten on the same stalk, and nobody who came here could stay, because nothing here would stay.',
    'Then a wanderer came out of the fog, in a coat of every colour, carrying a lantern with a single light in it. The light was two colours until you looked at it. The people who saw him called him QubitMan, because he was both one thing and another until he chose.',
    'For seven days he walked the valley and looked. On the first day he looked at the river, and it chose to flow south. On the second, the hills chose to stand. On the third, the soil chose to be fertile. On the fourth, the well chose to be deep. On the fifth and sixth, the sun and the seasons chose their order.',
    'On the seventh day he looked at the people. And they chose to stay.',
    'Then he set down his lantern in the place where the plaza is now, and was gone. Some say he walked on into the Eigenlands to measure the rest of the world. Some say he never left at all, and is still here, in superposition, keeping an eye on us.',
    'Every morning, the people of Hadamere greet him the same way. You will hear it at the well, at the forge, at the inn: ALL HAIL QUBITMAN.',
  ],
} as const;

/** A random villager remark about the statue (lore panel footer). */
export const STATUE_REMARKS: Array<[string, string]> = [
  ['juniper', 'He winks at night. I saw it. Probably.'],
  ['odo', "Grandpa carved the plinth. Don't sit on it."],
  ['brannoch', "Rings two notes at once when you tap it. Don't tap it."],
  ['wren', "Best sentence ever cast in bronze. I'd add a footnote."],
  ['maribel', "He ate leek and potato soup at my grandmother's table. Twice. Or once, both ways."],
  ['pippa', 'Bronze! For a man with a coat of every colour! Criminal.'],
];

// ───────────────────────── line composer ─────────────────────────

export interface TalkCtx {
  pts: number;
  hour: number;
  season: number;
  weather: Weather;
  /** first conversation with this NPC today */
  first: boolean;
  /** the NPC is at a work block of its schedule */
  atWork: boolean;
  rand: () => number;
  /** a recent player deed the NPC has not commented on yet */
  deed?: { kind: DeedKind; what: string } | null;
  /** last gift item name, for memory */
  lastGift?: string | null;
  /** player outfit index (Pippa notices) */
  outfit?: number;
}

const pick = <T>(a: readonly T[], rand: () => number): T => a[Math.floor(rand() * a.length)]!;
export const fill = (t: string, vars: Record<string, string>): string =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
export const timeOfDay = (hour: number): 'morning' | 'day' | 'evening' | 'night' =>
  hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'evening' : 'night';

/**
 * A line for a normal conversation: greeting (time of day) or small talk (friendship tier), coloured by weather, season and
 * work, plus a memory remark about a recent deed or the last gift. Rumors are appended by the caller.
 */
export function composeTalk(npc: NpcDef, ctx: TalkCtx): { text: string; usedDeed: boolean } {
  const v = V[npc.id];
  const L = npc.lines;
  const r = ctx.rand;
  if (!v) return { text: pick(L.greet[tierOf(ctx.pts)], r), usedDeed: false };
  const parts: string[] = [];
  const tod = timeOfDay(ctx.hour);
  const tier = tierOf(ctx.pts);
  if (ctx.first) parts.push(pick(v.greet[tod], r));
  else parts.push(r() < 0.5 ? pick(v.again, r) : pick(v.chat[tier], r));
  // one colour line: weather beats season beats work beats small talk
  const x = r();
  const wet = ctx.weather === 'rain' || ctx.weather === 'storm';
  if (tod === 'night') {
    if (x < 0.5) parts.push(pick(L.night, r));
  } else if (wet && x < 0.55) parts.push(pick(L.rain, r));
  else if (ctx.weather === 'snow' && x < 0.55) parts.push(pick(L.snow, r));
  else if (x < 0.35) parts.push(pick(L.season[ctx.season] ?? L.season[0], r));
  else if (ctx.atWork && x < 0.6) parts.push(pick(L.work, r));
  else if (ctx.first && x < 0.85) parts.push(pick(v.chat[tier], r));
  // memory
  let usedDeed = false;
  const deedLines = ctx.deed ? v.deeds[ctx.deed.kind] : undefined;
  if (deedLines?.length && r() < 0.7) {
    parts.push(fill(pick(deedLines, r), { what: ctx.deed!.what }));
    usedDeed = true;
  } else if (ctx.lastGift && r() < 0.3) parts.push(fill(pick(v.memory, r), { item: ctx.lastGift }));
  if (npc.id === 'pippa' && ctx.outfit !== undefined && r() < 0.35)
    parts.push(PIPPA_OUTFIT[ctx.outfit] ?? PIPPA_OUTFIT[0]!);
  // dedupe (pick may hit the same line twice)
  return { text: [...new Set(parts)].join(' '), usedDeed };
}

const PIPPA_OUTFIT = [
  'And darling, the starter clothes. Still. We need to talk.',
  'The Ember Tunic! Bold. Fiery. I approve.',
  'A Phase Robe! Very mysterious. Very Wren.',
  'The Forester Coat. Earthy. Grounded. Fenwick would weep.',
  'Sunlit Vest! You look like a sunrise, darling.',
  'Frostweave. Crisp, cool, devastating.',
  "The Crimson Jerkin! Somebody's feeling dramatic. Good.",
  "Skyfarer's hat! You look like you're about to discover a continent.",
];

/** The next heart event the player has earned but not seen. */
export function pendingEvent(
  npcId: string,
  pts: number,
  seen: readonly string[],
): { id: string; ev: HeartEvent } | null {
  const v = V[npcId];
  if (!v) return null;
  const h = hearts(pts);
  for (let i = 0; i < v.events.length; i++) {
    const ev = v.events[i]!;
    const id = `${npcId}:${i}`;
    if (h >= ev.hearts && !seen.includes(id)) return { id, ev };
  }
  return null;
}

/** Ambient chatter for a villager doing `doing` (client-side bubbles). */
export function barkFor(npcId: string, doing: string, weather: Weather, rand: () => number): string | null {
  const v = V[npcId];
  if (!v) return null;
  if (/asleep/.test(doing)) return 'Zzz…';
  if (/shelter/.test(doing))
    return pick(['Brr. What weather.', 'Staying dry, staying dry.', 'Listen to that rain!'], rand);
  const work = /work|forge|cook|counter|field|fishing|brewing|loom|building|desk|tending/.test(doing);
  const wet = weather === 'rain' || weather === 'storm';
  if (wet && rand() < 0.25) return pick(NPC_BY_ID[npcId]!.lines.rain, rand);
  return pick(work ? v.barks.work : v.barks.free, rand);
}

/** Extra gift reactions (merged with the basic ones in npcs.ts). '{item}' = the gift. */
export const GIFT_EXTRA: Record<string, Partial<Record<'love' | 'like' | 'neutral' | 'hate', string[]>>> = {
  orla: {
    love: ['A {item}! Oh, you remembered. I\'m putting this in the ledger under "highlights of the year".'],
    like: ['A {item}, how lovely. Noted, filed, and appreciated.'],
    hate: ["A {item}. How… memorable. I'll find it a nice drawer."],
  },
  tobin: {
    love: [
      "A {item}?! Do you know what this is worth? Don't answer. I'm keeping it. Priceless. Literally, I refuse to price it.",
    ],
    like: ['A {item}! Excellent quality. I can tell. I can always tell.'],
    hate: ['A {item}. Hm. Market value: sentimental. Very, very sentimental.'],
  },
  brannoch: {
    love: ['…A {item}. *hums* Mm. Mm. Thank you.'],
    like: ['A {item}. Useful. Good.'],
    hate: ['A {item}. Why.'],
  },
  maribel: {
    love: ['A {item}! Oh, you angel! This is going in something special tonight.'],
    like: ['Ooh, a {item}! My kitchen thanks you.'],
    hate: ["A {item}, dear? In my kitchen? …I'll keep it in the shed."],
  },
  fenwick: {
    love: ["A {item}! Well, butter my biscuits. That's the nicest thing anyone's done all season."],
    like: ['A {item}. Fine one, too. Thank you kindly.'],
    hate: ['A {item}? Er. The goat might want it. The goat wants everything.'],
  },
  sedge: { love: ["A {item}. …That's… thanks. Really."], like: ['A {item}. Nice.'], hate: ['…A {item}. Huh.'] },
  wren: {
    love: ["A {item}?! It's perfect! Can I measure it? I'm going to measure it."],
    like: ['Oh, a {item}! Useful for at least three experiments.'],
    hate: ['A {item}. For the… control group. Thank you.'],
  },
  pippa: {
    love: ["A {item}! Darling! The colour! The texture! I'm going to faint. Gracefully."],
    like: ['A {item}, how chic.'],
    hate: ['A {item}. Darling. No. …Thank you. No.'],
  },
  odo: {
    love: ["A {item}. …Huh. That's good. That's real good. Don't look at me."],
    like: ['A {item}. Hm. Thanks.'],
    hate: ['A {item}?! What am I supposed to build with this?'],
  },
  juniper: {
    love: ['A {item}!!! For ME?! This is going straight in my treasure box! RIGHT NOW!'],
    like: ['A {item}! Cool! Thanks!'],
    hate: ["Ew, a {item}! Gerald doesn't want it either."],
  },
};
