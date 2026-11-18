import { buildAnswerIndex, starterChallenges } from './challenges.mjs';
import { MAX_ANSWERS } from './gameRules.mjs';
import { practiceChallengePacks } from './practiceChallengePacks.mjs';
import { expandPracticeAnswers } from './practiceAnswerExpansions.mjs';

// IDs stay stable independently of the daily rotation and catalog ordering.
const catalog = [
  { id: 'countries-m', theme: 'geography', ...starterChallenges[0] },
  { id: 'solar-system-planets', theme: 'space', ...starterChallenges[1] },
  { id: 'south-american-countries', theme: 'geography', ...starterChallenges[2] },
  {
    id: 'dog-breeds', theme: 'animals', category: 'Animals & Nature', title: 'Dog breeds',
    answers: [
      ['Labrador Retriever', 'Labrador', 'Lab'], ['Golden Retriever'], ['German Shepherd', 'German Shepherd Dog', 'Alsatian'],
      ['Beagle'], ['Poodle'], ['Bulldog'], ['Boxer'], ['Pug'], ['Chihuahua'], ['Dachshund'],
    ],
  },
  {
    id: 'musical-instruments', theme: 'entertainment', category: 'Entertainment & Culture', title: 'Musical instruments',
    answers: [
      ['Piano'], ['Guitar'], ['Violin', 'Fiddle'], ['Flute'], ['Trumpet'], ['Trombone'],
      ['Clarinet'], ['Saxophone'], ['Drums', 'Drum', 'Drum kit'], ['Cello', 'Violoncello'], ['Harp'],
      ['Viola'], ['Oboe'], ['Bassoon'], ['Tuba'], ['Double bass', 'Upright bass'], ['Piccolo'],
      ['Banjo'], ['Ukulele', 'Ukelele'], ['Mandolin'], ['Accordion'], ['Harmonica'], ['Organ'], ['Xylophone'],
    ],
  },
  {
    id: 'one-letter-elements', theme: 'knowledge', category: 'General Knowledge', title: 'Chemical elements with one-letter symbols',
    answers: [
      ['Hydrogen', 'H'], ['Boron', 'B'], ['Carbon', 'C'], ['Nitrogen', 'N'], ['Oxygen', 'O'], ['Fluorine', 'F'],
      ['Phosphorus', 'P'], ['Sulfur', 'Sulphur', 'S'], ['Potassium', 'K'], ['Vanadium', 'V'],
      ['Yttrium', 'Y'], ['Iodine', 'I'], ['Tungsten', 'W'], ['Uranium', 'U'],
    ],
  },
  {
    id: 'rhymes-with-light', theme: 'words', category: 'Words & Thinking', title: 'Words that rhyme with "light"',
    answers: [
      ['Night'], ['Bright'], ['Flight'], ['Might'], ['Sight'], ['Right'], ['White'], ['Tight'], ['Fight'], ['Bite'],
      ['Kite'], ['Knight'], ['Height'], ['Write'], ['Site'], ['Cite'], ['Rite'], ['Byte'], ['Mite'],
      ['Fright'], ['Slight'], ['Plight'], ['Spite'], ['Quite'], ['Sprite'], ['Blight'], ['Lite'], ['Smite'], ['Trite'],
    ],
  },
  ...practiceChallengePacks,
].map(expandPracticeAnswers).map(challenge => ({ ...challenge, prompt: `Name ${MAX_ANSWERS} ${challenge.title.charAt(0).toLowerCase()}${challenge.title.slice(1)}` }));

for (const challenge of catalog) buildAnswerIndex(challenge.answers);

// Public metadata excludes accepted answers and aliases.
export function getPracticeThemes() {
  const themes = new Map();
  for (const { id, theme, category, prompt } of catalog) {
    if (!themes.has(theme)) themes.set(theme, { id: theme, name: category, challenges: [] });
    themes.get(theme).challenges.push({ id, prompt });
  }
  return [...themes.values()];
}

export function getPracticeChallenge(id) {
  const challenge = catalog.find(challenge => challenge.id === id);
  return challenge ? structuredClone(challenge) : null;
}
