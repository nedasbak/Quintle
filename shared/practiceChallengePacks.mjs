const theme = (id, category, challenges) => challenges.map(challenge => ({ ...challenge, theme: id, category }));

export const practiceChallengePacks = [
  ...theme('geography', 'Geography', [
    { id: 'four-letter-countries', title: 'Countries in the UN with four-letter English names', answers: [
      ['Chad'], ['Cuba'], ['Fiji'], ['Iran'], ['Iraq'], ['Laos'], ['Mali'], ['Oman'], ['Peru'], ['Togo'],
    ] },
    { id: 'germany-neighbours', title: 'Countries that share a land border with Germany', answers: [
      ['Austria'], ['Belgium'], ['Czechia', 'Czech Republic'], ['Denmark'], ['France'], ['Luxembourg'], ['Netherlands', 'The Netherlands'], ['Poland'], ['Switzerland'],
    ] },
    { id: 'seven-continents', title: 'Continents in the seven-continent model', answers: [
      ['Africa'], ['Antarctica'], ['Asia'], ['Australia', 'Oceania'], ['Europe'], ['North America'], ['South America'],
    ] },
  ]),
  ...theme('space', 'Space', [
    { id: 'iau-dwarf-planets', title: 'Dwarf planets officially recognized by the IAU', answers: [
      ['Ceres'], ['Pluto'], ['Haumea'], ['Makemake'], ['Eris'],
    ] },
    { id: 'uranus-major-moons', title: 'Major moons of Uranus', answers: [
      ['Miranda'], ['Ariel'], ['Umbriel'], ['Titania'], ['Oberon'],
    ] },
    { id: 'traditional-zodiac', title: 'Constellations in the traditional twelve-sign zodiac', answers: [
      ['Aries'], ['Taurus'], ['Gemini'], ['Cancer'], ['Leo'], ['Virgo'], ['Libra'], ['Scorpius', 'Scorpio'], ['Sagittarius'], ['Capricornus', 'Capricorn'], ['Aquarius'], ['Pisces'],
    ] },
    { id: 'apollo-moonwalkers', title: 'People who walked on the Moon during Apollo missions', answers: [
      ['Neil Armstrong', 'Armstrong'], ['Buzz Aldrin', 'Edwin Aldrin', 'Aldrin'], ['Pete Conrad', 'Charles Conrad', 'Conrad'], ['Alan Bean', 'Bean'],
      ['Alan Shepard', 'Shepard'], ['Edgar Mitchell', 'Ed Mitchell', 'Mitchell'], ['David Scott', 'Dave Scott', 'Scott'], ['James Irwin', 'Jim Irwin', 'Irwin'],
      ['John Young', 'Young'], ['Charles Duke', 'Charlie Duke', 'Duke'], ['Eugene Cernan', 'Gene Cernan', 'Cernan'], ['Harrison Schmitt', 'Jack Schmitt', 'Schmitt'],
    ] },
  ]),
  ...theme('animals', 'Animals & Nature', [
    { id: 'panthera-cats', title: 'Big cat species in the genus Panthera', answers: [
      ['Lion', 'Lions'], ['Tiger', 'Tigers'], ['Jaguar', 'Jaguars'], ['Leopard', 'Leopards'], ['Snow leopard', 'Snow leopards'],
    ] },
    { id: 'living-bears', title: 'Living bear species', answers: [
      ['Brown bear', 'Grizzly bear', 'Grizzly'], ['American black bear', 'North American black bear'], ['Asian black bear', 'Asiatic black bear', 'Moon bear'], ['Polar bear'],
      ['Giant panda', 'Panda', 'Panda bear'], ['Sloth bear'], ['Sun bear'], ['Andean bear', 'Spectacled bear'],
    ] },
    { id: 'living-rhinos', title: 'Living rhinoceros species', answers: [
      ['White rhinoceros', 'White rhino'], ['Black rhinoceros', 'Black rhino'], ['Indian rhinoceros', 'Indian rhino', 'Greater one-horned rhinoceros', 'Greater one-horned rhino'],
      ['Javan rhinoceros', 'Javan rhino'], ['Sumatran rhinoceros', 'Sumatran rhino'],
    ] },
    { id: 'vertebrate-groups', title: 'Major vertebrate groups taught in school', answers: [
      ['Mammals', 'Mammal'], ['Birds', 'Bird'], ['Reptiles', 'Reptile'], ['Amphibians', 'Amphibian'], ['Fish', 'Fishes'],
    ] },
  ]),
  ...theme('entertainment', 'Entertainment & Culture', [
    { id: 'official-disney-princesses', title: 'Characters in the official Disney Princess lineup', answers: [
      ['Snow White'], ['Cinderella'], ['Aurora', 'Sleeping Beauty'], ['Ariel'], ['Belle'], ['Jasmine'], ['Pocahontas'], ['Mulan'], ['Tiana'], ['Rapunzel'], ['Merida'], ['Moana', 'Vaiana'], ['Raya'],
    ] },
    { id: 'friends-main-characters', title: 'Main characters in Friends (first names accepted)', answers: [
      ['Rachel Green', 'Rachel', 'Rachel Greene'], ['Monica Geller', 'Monica'], ['Phoebe Buffay', 'Phoebe'], ['Joey Tribbiani', 'Joey'], ['Chandler Bing', 'Chandler'], ['Ross Geller', 'Ross'],
    ] },
    { id: 'chess-piece-types', title: 'Chess piece types, including pawns', answers: [
      ['King'], ['Queen'], ['Rook', 'Castle'], ['Bishop'], ['Knight'], ['Pawn'],
    ] },
    { id: 'natural-note-letters', title: 'Natural musical note names (use letters)', answers: [
      ['A'], ['B'], ['C'], ['D'], ['E'], ['F'], ['G'],
    ] },
  ]),
  ...theme('knowledge', 'General Knowledge', [
    { id: 'rainbow-colours', title: 'Colours in the traditional seven-colour rainbow', answers: [
      ['Red'], ['Orange'], ['Yellow'], ['Green'], ['Blue'], ['Indigo'], ['Violet', 'Purple'],
    ] },
    { id: 'traditional-senses', title: 'Traditional human senses', answers: [
      ['Sight', 'Vision', 'Seeing'], ['Hearing', 'Sound'], ['Smell', 'Smelling'], ['Taste', 'Tasting'], ['Touch', 'Feeling'],
    ] },
    { id: 'si-base-units', title: 'Base units in the SI (write their names)', answers: [
      ['Second', 'Seconds'], ['Metre', 'Meter', 'Metres', 'Meters'], ['Kilogram', 'Kilograms'], ['Ampere', 'Amp', 'Amperes', 'Amps'], ['Kelvin', 'Kelvins'], ['Mole', 'Moles'], ['Candela', 'Candelas'],
    ] },
    { id: 'nobel-categories', title: 'Categories awarded a Nobel Prize or the economics memorial prize', answers: [
      ['Physics'], ['Chemistry'], ['Physiology or Medicine', 'Medicine', 'Physiology'], ['Literature'], ['Peace'], ['Economic Sciences', 'Economics'],
    ] },
  ]),
  ...theme('words', 'Words & Thinking', [
    { id: 'months-with-r', title: 'Months whose English names contain the letter R', answers: [
      ['January'], ['February'], ['March'], ['April'], ['September'], ['October'], ['November'], ['December'],
    ] },
    { id: 'nato-vowel-words', title: 'Vowel-starting code words in the NATO phonetic alphabet', answers: [
      ['Alfa', 'Alpha'], ['Echo'], ['India'], ['Oscar'], ['Uniform'],
    ] },
    { id: 'numbers-with-e', title: 'Numbers from one to ten whose English names contain E', answers: [
      ['One'], ['Three'], ['Five'], ['Seven'], ['Eight'], ['Nine'], ['Ten'],
    ] },
    { id: 'english-vowels', title: 'Vowel letters in English other than Y', answers: [
      ['A'], ['E'], ['I'], ['O'], ['U'],
    ] },
  ]),
];
