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
  ...theme('technology', 'Technology', [
    { id: 'programming-languages', title: 'Programming languages', answers: [
      ['Python'], ['JavaScript', 'JS', 'Java Script'], ['TypeScript', 'TS', 'Type Script'], ['Java'], ['C'], ['C++', 'CPP', 'C plus plus'], ['C#', 'C sharp', 'CSharp'],
      ['Go', 'Golang'], ['Rust'], ['Ruby'], ['PHP'], ['Swift'], ['Kotlin'], ['Dart'], ['Scala'], ['R'], ['Julia'], ['Lua'], ['Perl'], ['Haskell'], ['Erlang'], ['Elixir'],
      ['Clojure'], ['F#', 'F sharp', 'FSharp'], ['OCaml'], ['COBOL'], ['Fortran'], ['Pascal'], ['BASIC'], ['Visual Basic', 'VB', 'VB.NET'], ['Objective-C', 'Objective C'],
      ['MATLAB'], ['Groovy'], ['Assembly', 'Assembly language', 'ASM'], ['Bash'], ['PowerShell'], ['SQL'], ['Delphi'], ['Ada'], ['Lisp', 'Common Lisp'], ['Scheme'],
      ['Racket'], ['Prolog'], ['Smalltalk'], ['Scratch'], ['Logo'], ['Forth'], ['D'], ['Zig'], ['Nim'], ['Crystal'], ['Solidity'], ['VHDL'], ['Verilog'], ['APL'], ['AWK'], ['Tcl'],
    ] },
    { id: 'javascript-primitives', title: 'Primitive JavaScript data types', answers: [
      ['String'], ['Number'], ['BigInt', 'Big integer'], ['Boolean', 'Bool'], ['Undefined'], ['Null'], ['Symbol'],
    ] },
    { id: 'http-rfc9110-methods', title: 'Core HTTP request methods defined in RFC 9110', answers: [
      ['GET'], ['HEAD'], ['POST'], ['PUT'], ['DELETE'], ['CONNECT'], ['OPTIONS'], ['TRACE'],
    ] },
    { id: 'html-input-types', title: 'Input types in HTML', answers: [
      ['Hidden'], ['Text'], ['Search'], ['Tel', 'Telephone'], ['URL'], ['Email', 'E-mail'], ['Password'], ['Date'], ['Month'], ['Week'], ['Time'],
      ['Datetime-local', 'Local datetime', 'Local date and time'], ['Number'], ['Range'], ['Color', 'Colour'], ['Checkbox'], ['Radio'], ['File'], ['Submit'], ['Image'], ['Reset'], ['Button'],
    ] },
    { id: 'hexadecimal-letters', title: 'Letters used as hexadecimal digits', answers: [
      ['A'], ['B'], ['C'], ['D'], ['E'], ['F'],
    ] },
  ]),
  ...theme('history', 'History', [
    { id: 'ancient-civilizations', title: 'Ancient civilizations established before 500 CE', answers: [
      ['Ancient Egypt', 'Egypt', 'Egyptian', 'Egyptians'], ['Ancient Greece', 'Greece', 'Greek', 'Greeks'], ['Ancient Rome', 'Rome', 'Roman', 'Romans'],
      ['Sumer', 'Sumerian', 'Sumerians'], ['Akkad', 'Akkadian', 'Akkadians'], ['Babylonia', 'Babylon', 'Babylonian', 'Babylonians'], ['Assyria', 'Assyrian', 'Assyrians'],
      ['Persia', 'Persian', 'Persians', 'Achaemenid Empire'], ['Phoenicia', 'Phoenician', 'Phoenicians'], ['Hittites', 'Hittite', 'Hittite Empire'], ['Minoans', 'Minoan'],
      ['Mycenaeans', 'Mycenaean', 'Mycenaean Greece'], ['Indus Valley', 'Indus', 'Harappan civilization', 'Harappans'], ['Ancient China', 'China', 'Chinese civilization'],
      ['Olmecs', 'Olmec'], ['Maya', 'Mayans', 'Mayan'], ['Etruscans', 'Etruscan'], ['Carthage', 'Carthaginian', 'Carthaginians'], ['Nubia', 'Nubian', 'Kush'],
      ['Elam', 'Elamite', 'Elamites'], ['Norte Chico', 'Caral'], ['Chavin'], ['Zapotecs', 'Zapotec'], ['Moche'], ['Nazca'], ['Aksum', 'Axum', 'Aksumite Empire'],
    ] },
    { id: 'henry-viii-wives', title: 'Wives of Henry VIII', answers: [
      ['Catherine of Aragon', 'Katherine of Aragon'], ['Anne Boleyn', 'Boleyn'], ['Jane Seymour', 'Seymour'], ['Anne of Cleves'],
      ['Catherine Howard', 'Katherine Howard', 'Howard'], ['Catherine Parr', 'Katherine Parr', 'Parr'],
    ] },
    { id: 'original-us-states', title: 'Original thirteen US states', answers: [
      ['New Hampshire'], ['Massachusetts'], ['Rhode Island'], ['Connecticut'], ['New York'], ['New Jersey'], ['Pennsylvania'], ['Delaware'], ['Maryland'], ['Virginia'], ['North Carolina'], ['South Carolina'], ['Georgia'],
    ] },
    { id: 'julio-claudian-emperors', title: 'Roman emperors of the Julio-Claudian dynasty', answers: [
      ['Augustus', 'Octavian'], ['Tiberius'], ['Caligula', 'Gaius Germanicus'], ['Claudius'], ['Nero'],
    ] },
    { id: 'first-ten-us-presidents', title: 'People among the first ten US presidents', answers: [
      ['George Washington', 'Washington'], ['John Adams'], ['Thomas Jefferson', 'Jefferson'], ['James Madison', 'Madison'], ['James Monroe', 'Monroe'],
      ['John Quincy Adams', 'John Q Adams', 'John Q. Adams'], ['Andrew Jackson', 'Jackson'], ['Martin Van Buren', 'Van Buren'], ['William Henry Harrison', 'William H Harrison', 'Harrison'], ['John Tyler', 'Tyler'],
    ] },
  ]),
  ...theme('science', 'Science', [
    { id: 'elements-starting-c', title: 'Chemical elements with English names starting with C', answers: [
      ['Cadmium'], ['Calcium'], ['Californium'], ['Carbon'], ['Cerium'], ['Caesium', 'Cesium'], ['Chlorine'], ['Chromium'], ['Cobalt'], ['Copernicium'], ['Copper'], ['Curium'],
    ] },
    { id: 'first-ten-elements', title: 'Chemical elements with atomic numbers 1 to 10', answers: [
      ['Hydrogen'], ['Helium'], ['Lithium'], ['Beryllium'], ['Boron'], ['Carbon'], ['Nitrogen'], ['Oxygen'], ['Fluorine'], ['Neon'],
    ] },
    { id: 'group-18-elements', title: 'Chemical elements in Group 18', answers: [
      ['Helium'], ['Neon'], ['Argon'], ['Krypton'], ['Xenon'], ['Radon'], ['Oganesson'],
    ] },
    { id: 'electromagnetic-spectrum', title: 'Regions of the electromagnetic spectrum', answers: [
      ['Radio waves', 'Radio wave', 'Radio'], ['Microwaves', 'Microwave'], ['Infrared', 'Infrared light', 'Infrared radiation', 'IR'], ['Visible light', 'Visible'],
      ['Ultraviolet', 'Ultraviolet light', 'Ultraviolet radiation', 'UV'], ['X-rays', 'X rays', 'X-ray', 'X ray', 'Xray'], ['Gamma rays', 'Gamma ray', 'Gamma', 'Gamma radiation'],
    ] },
    { id: 'si-derived-units', title: 'Derived SI units with special names (write their names)', answers: [
      ['Radian'], ['Steradian'], ['Hertz'], ['Newton'], ['Pascal'], ['Joule'], ['Watt'], ['Coulomb'], ['Volt'], ['Farad'], ['Ohm'], ['Siemens'],
      ['Weber'], ['Tesla'], ['Henry'], ['Degree Celsius', 'Celsius'], ['Lumen'], ['Lux'], ['Becquerel'], ['Gray', 'Grey'], ['Sievert'], ['Katal'],
    ] },
  ]),
  ...theme('movies-tv', 'Movies & TV', [
    { id: 'nolan-films-before-2025', title: 'Feature films directed by Christopher Nolan before 2025', answers: [
      ['Following'], ['Memento'], ['Insomnia'], ['Batman Begins'], ['The Prestige', 'Prestige'], ['The Dark Knight', 'Dark Knight'], ['Inception'],
      ['The Dark Knight Rises', 'Dark Knight Rises'], ['Interstellar'], ['Dunkirk'], ['Tenet'], ['Oppenheimer'],
    ] },
    { id: 'skywalker-saga-subtitles', title: 'Film subtitles in the Star Wars Skywalker Saga', answers: [
      ['The Phantom Menace', 'Phantom Menace', 'Star Wars: The Phantom Menace'], ['Attack of the Clones', 'Star Wars: Attack of the Clones'], ['Revenge of the Sith', 'Star Wars: Revenge of the Sith'],
      ['A New Hope', 'New Hope', 'Star Wars: A New Hope'], ['The Empire Strikes Back', 'Empire Strikes Back', 'Star Wars: The Empire Strikes Back'], ['Return of the Jedi', 'Star Wars: Return of the Jedi'],
      ['The Force Awakens', 'Force Awakens', 'Star Wars: The Force Awakens'], ['The Last Jedi', 'Last Jedi', 'Star Wars: The Last Jedi'], ['The Rise of Skywalker', 'Rise of Skywalker', 'Star Wars: The Rise of Skywalker'],
    ] },
    { id: 'pixar-films-before-2007', title: 'Feature films released by Pixar before 2007', answers: [
      ['Toy Story'], ["A Bug's Life", 'A Bug’s Life', 'A Bugs Life', 'Bugs Life'], ['Toy Story 2', 'Toy Story II'], ['Monsters, Inc.', 'Monsters Inc', 'Monsters Inc.', 'Monsters Incorporated'],
      ['Finding Nemo'], ['The Incredibles', 'Incredibles'], ['Cars'],
    ] },
    { id: 'peter-jackson-middle-earth', title: 'Feature films set in Middle-earth and directed by Peter Jackson', answers: [
      ['The Fellowship of the Ring', 'Fellowship of the Ring', 'The Lord of the Rings: The Fellowship of the Ring', 'LOTR: The Fellowship of the Ring'],
      ['The Two Towers', 'Two Towers', 'The Lord of the Rings: The Two Towers', 'LOTR: The Two Towers'], ['The Return of the King', 'Return of the King', 'The Lord of the Rings: The Return of the King', 'LOTR: The Return of the King'],
      ['An Unexpected Journey', 'The Hobbit: An Unexpected Journey'], ['The Desolation of Smaug', 'Desolation of Smaug', 'The Hobbit: The Desolation of Smaug'],
      ['The Battle of the Five Armies', 'Battle of the Five Armies', 'Battle of Five Armies', 'The Hobbit: The Battle of the Five Armies'],
    ] },
    { id: 'original-film-avengers', title: 'Original Avengers in the 2012 film (hero or civilian names)', answers: [
      ['Iron Man', 'Tony Stark', 'Ironman'], ['Captain America', 'Steve Rogers'], ['Thor', 'Thor Odinson'], ['Hulk', 'The Hulk', 'Bruce Banner'], ['Black Widow', 'Natasha Romanoff', 'Natasha Romanov'], ['Hawkeye', 'Clint Barton'],
    ] },
  ]),
  ...theme('gaming', 'Gaming', [
    { id: 'minecraft-nether-biomes', title: 'Biomes in the Minecraft Nether', answers: [
      ['Nether Wastes', 'Nether Waste'], ['Soul Sand Valley', 'Soulsand Valley'], ['Crimson Forest'], ['Warped Forest'], ['Basalt Deltas', 'Basalt Delta'],
    ] },
    { id: 'first-nine-pokemon', title: 'Creatures with National Pokédex numbers 1 to 9', answers: [
      ['Bulbasaur'], ['Ivysaur'], ['Venusaur'], ['Charmander'], ['Charmeleon'], ['Charizard'], ['Squirtle'], ['Wartortle'], ['Blastoise'],
    ] },
    { id: 'tetris-piece-letters', title: 'Letters used to name the seven standard Tetris pieces', answers: [
      ['I', 'I piece'], ['J', 'J piece'], ['L', 'L piece'], ['O', 'O piece'], ['S', 'S piece'], ['T', 'T piece'], ['Z', 'Z piece'],
    ] },
    { id: 'stardew-valley-skills', title: 'Skills in Stardew Valley', answers: [
      ['Farming'], ['Mining'], ['Combat'], ['Fishing'], ['Foraging'],
    ] },
    { id: 'mario-kart-64-drivers', title: 'Playable characters in Mario Kart 64', answers: [
      ['Mario'], ['Luigi'], ['Peach', 'Princess Peach'], ['Toad'], ['Yoshi'], ['Wario'], ['Donkey Kong', 'DK'], ['Bowser', 'King Koopa'],
    ] },
  ]),
];
