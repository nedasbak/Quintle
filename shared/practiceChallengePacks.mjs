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
  ...theme('food-drinks', 'Food & Drinks', [
    { id: 'pasta-types', title: 'Types of pasta', answers: [
      ['Spaghetti'], ['Penne', 'Penne rigate'], ['Fusilli'], ['Farfalle', 'Bow tie pasta', 'Bowtie pasta'], ['Rigatoni'], ['Macaroni', 'Elbow macaroni'], ['Linguine'], ['Fettuccine', 'Fettucine'],
      ['Tagliatelle'], ['Pappardelle'], ['Lasagne', 'Lasagna'], ['Ravioli'], ['Tortellini'], ['Tortelloni'], ['Cannelloni'], ['Manicotti'], ['Bucatini'], ['Capellini', 'Angel hair'], ['Vermicelli'],
      ['Orzo'], ['Orecchiette'], ['Conchiglie', 'Shell pasta'], ['Cavatappi'], ['Cavatelli'], ['Ditalini'], ['Ziti'], ['Rotini'], ['Gemelli'], ['Paccheri'], ['Radiatori'], ['Mafaldine'], ['Stelline'], ['Acini di pepe'],
    ] },
    { id: 'french-mother-sauces', title: 'Mother sauces in French cuisine', answers: [
      ['Béchamel', 'White sauce'], ['Velouté'], ['Espagnole', 'Espagnole sauce'], ['Hollandaise'], ['Tomato sauce', 'Tomato', 'Sauce tomate', 'Sauce tomat', 'Tomate'],
    ] },
    { id: 'basic-tastes', title: 'Basic tastes', answers: [
      ['Sweet', 'Sweetness'], ['Sour', 'Sourness'], ['Salty', 'Saltiness', 'Salt'], ['Bitter', 'Bitterness'], ['Umami', 'Savory', 'Savoury'],
    ] },
    { id: 'culinary-herbs', title: 'Herbs used in cooking', answers: [
      ['Basil'], ['Parsley'], ['Coriander', 'Cilantro'], ['Mint'], ['Rosemary'], ['Thyme'], ['Sage'], ['Oregano'], ['Marjoram'], ['Dill'], ['Chives'], ['Tarragon'], ['Chervil'],
      ['Bay leaf', 'Bay', 'Bay leaves'], ['Lemon balm'], ['Lemongrass', 'Lemon grass'], ['Savory', 'Savoury'], ['Lovage'], ['Fennel'], ['Sorrel'], ['Shiso', 'Perilla'], ['Curry leaves', 'Curry leaf'], ['Fenugreek'],
    ] },
    { id: 'espresso-drinks', title: 'Mixed coffee drinks containing espresso', answers: [
      ['Latte', 'Caffe latte', 'Caffè latte'], ['Cappuccino', 'Capuccino'], ['Americano', 'Caffe americano'], ['Cortado'], ['Flat white'], ['Mocha', 'Caffe mocha'], ['Espresso macchiato', 'Macchiato', 'Caffe macchiato'],
      ['Latte macchiato'], ['Long black'], ['Red eye'], ['Black eye'], ['Espresso con panna', 'Con panna'], ['Espresso tonic'], ['Dirty chai', 'Dirty chai latte'], ['Breve', 'Caffe breve'],
    ] },
  ]),
  ...theme('sports', 'Sports', [
    { id: 'paris-2024-ball-sports', title: 'Olympic sports or disciplines played with a ball at Paris 2024', answers: [
      ['Basketball', '3x3 basketball', 'Basketball 3x3'], ['Football', 'Soccer'], ['Golf'], ['Handball'], ['Hockey', 'Field hockey'], ['Rugby sevens', 'Rugby', 'Rugby 7s'],
      ['Tennis'], ['Table tennis', 'Ping pong', 'Ping-pong'], ['Volleyball'], ['Beach volleyball'], ['Water polo'],
    ] },
    { id: 'decathlon-events', title: "Events in the men's outdoor decathlon", answers: [
      ['100 metres', '100m', '100 meters'], ['Long jump'], ['Shot put', 'Shotput'], ['High jump'], ['400 metres', '400m', '400 meters'], ['110 metres hurdles', '110m hurdles', '110 meter hurdles'],
      ['Discus throw', 'Discus'], ['Pole vault'], ['Javelin throw', 'Javelin'], ['1500 metres', '1500m', '1500 meters'],
    ] },
    { id: 'heptathlon-events', title: "Events in the women's outdoor heptathlon", answers: [
      ['100 metres hurdles', '100m hurdles', '100 meter hurdles'], ['High jump'], ['Shot put', 'Shotput'], ['200 metres', '200m', '200 meters'], ['Long jump'], ['Javelin throw', 'Javelin'], ['800 metres', '800m', '800 meters'],
    ] },
    { id: 'world-cup-winners-2022', title: "Countries that won the men's FIFA World Cup by the end of 2022", answers: [
      ['Uruguay'], ['Italy'], ['Germany', 'West Germany', 'Federal Republic of Germany'], ['Brazil', 'Brasil'], ['England'], ['Argentina'], ['France'], ['Spain'],
    ] },
    { id: 'nba-teams-2024', title: 'Teams in the NBA during the 2024–25 season', answers: [
      ['Atlanta Hawks', 'Hawks'], ['Boston Celtics', 'Celtics'], ['Brooklyn Nets', 'Nets'], ['Charlotte Hornets', 'Hornets'], ['Chicago Bulls', 'Bulls'], ['Cleveland Cavaliers', 'Cavaliers', 'Cavs'],
      ['Dallas Mavericks', 'Mavericks', 'Mavs'], ['Denver Nuggets', 'Nuggets'], ['Detroit Pistons', 'Pistons'], ['Golden State Warriors', 'Warriors'], ['Houston Rockets', 'Rockets'], ['Indiana Pacers', 'Pacers'],
      ['Los Angeles Clippers', 'LA Clippers', 'Clippers'], ['Los Angeles Lakers', 'LA Lakers', 'Lakers'], ['Memphis Grizzlies', 'Grizzlies'], ['Miami Heat', 'Heat'], ['Milwaukee Bucks', 'Bucks'],
      ['Minnesota Timberwolves', 'Timberwolves', 'Wolves'], ['New Orleans Pelicans', 'Pelicans'], ['New York Knicks', 'Knicks'], ['Oklahoma City Thunder', 'OKC Thunder', 'Thunder'], ['Orlando Magic', 'Magic'],
      ['Philadelphia 76ers', '76ers', 'Sixers'], ['Phoenix Suns', 'Suns'], ['Portland Trail Blazers', 'Trail Blazers', 'Blazers'], ['Sacramento Kings', 'Kings'], ['San Antonio Spurs', 'Spurs'], ['Toronto Raptors', 'Raptors'], ['Utah Jazz', 'Jazz'], ['Washington Wizards', 'Wizards'],
    ] },
  ]),
  ...theme('music', 'Music', [
    { id: 'rock-bands-before-1990', title: 'Rock bands formed before 1990', answers: [
      ['The Beatles', 'Beatles'], ['The Rolling Stones', 'Rolling Stones'], ['Queen'], ['Led Zeppelin'], ['Pink Floyd'], ['The Who', 'Who'], ['The Doors', 'Doors'], ['AC/DC', 'ACDC', 'AC DC'],
      ["Guns N' Roses", 'Guns N Roses', 'Guns and Roses', 'Guns N’ Roses'], ['Metallica'], ['Nirvana'], ['Green Day'], ['U2'], ['Radiohead'], ['Red Hot Chili Peppers', 'RHCP'], ['Kiss'], ['Deep Purple'],
      ['Black Sabbath'], ['Iron Maiden'], ['Judas Priest'], ['Aerosmith'], ['Bon Jovi'], ['Def Leppard'], ['The Clash', 'Clash'], ['Ramones', 'The Ramones'], ['R.E.M.', 'REM'], ['The Cure', 'Cure'], ['Fleetwood Mac'],
      ['Eagles', 'The Eagles'], ['Journey'], ['Boston'], ['Europe'], ['Scorpions', 'The Scorpions'], ['Dire Straits'], ['ZZ Top'], ['Van Halen'], ['The Kinks', 'Kinks'], ['Rush'], ['Yes'], ['Genesis'], ['King Crimson'],
      ['Soundgarden'], ['Alice in Chains'], ['The Smashing Pumpkins', 'Smashing Pumpkins'], ['Pixies', 'The Pixies'], ['The Police', 'Police'], ['The Beach Boys', 'Beach Boys'], ['Creedence Clearwater Revival', 'CCR'], ['Lynyrd Skynyrd'], ['Cheap Trick'], ['Heart'], ['Talking Heads'], ['Blondie'], ['Sonic Youth'], ['The Smiths', 'Smiths'],
    ] },
    { id: 'beatles-studio-albums', title: "Studio albums in the Beatles' core catalogue", answers: [
      ['Please Please Me'], ['With the Beatles'], ["A Hard Day's Night", 'A Hard Days Night', 'A Hard Day’s Night'], ['Beatles for Sale'], ['Help!', 'Help'], ['Rubber Soul'], ['Revolver'],
      ["Sgt. Pepper's Lonely Hearts Club Band", "Sgt Pepper's Lonely Hearts Club Band", 'Sgt Peppers Lonely Hearts Club Band', 'Sgt Pepper', 'Sgt Peppers', 'Sergeant Pepper', 'Sgt Pepper’s Lonely Hearts Club Band'], ['Magical Mystery Tour'], ['The Beatles', 'White Album', 'The White Album'], ['Yellow Submarine'], ['Abbey Road'], ['Let It Be'],
    ] },
    { id: 'abba-albums-before-1990', title: 'Studio albums released by ABBA before 1990', answers: [
      ['Ring Ring'], ['Waterloo'], ['ABBA'], ['Arrival'], ['The Album', 'ABBA The Album', 'ABBA: The Album'], ['Voulez-Vous', 'Voulez Vous'], ['Super Trouper'], ['The Visitors'],
    ] },
    { id: 'jackson-five-members', title: 'Members of the Jackson 5 during their Motown years', answers: [
      ['Michael Jackson', 'Michael'], ['Jackie Jackson', 'Jackie', 'Sigmund Jackson'], ['Tito Jackson', 'Tito', 'Toriano Jackson'], ['Jermaine Jackson', 'Jermaine'], ['Marlon Jackson', 'Marlon'],
    ] },
    { id: 'orchestral-woodwinds', title: 'Woodwind instruments, including historical types', answers: [
      ['Flute'], ['Piccolo'], ['Oboe'], ['Cor anglais', 'English horn'], ['Clarinet'], ['Bass clarinet'], ['Bassoon'], ['Contrabassoon', 'Double bassoon'], ['Saxophone', 'Sax'],
      ['Alto flute'], ['Bass flute'], ['E-flat clarinet', 'E flat clarinet', 'Eb clarinet'], ['Contrabass clarinet'], ["Oboe d'amore", 'Oboe damore'], ['Bass oboe'], ['Heckelphone'],
    ] },
  ]),
  ...theme('brands-companies', 'Brands & Companies', [
    { id: 'smartphone-brands', title: 'Brands that have sold smartphones', answers: [
      ['Apple'], ['Samsung'], ['Google'], ['Nokia'], ['Motorola'], ['Sony'], ['LG'], ['HTC'], ['BlackBerry', 'Black Berry'], ['Huawei'], ['Honor'], ['Xiaomi'], ['Redmi'], ['Poco'], ['OnePlus', 'One Plus'],
      ['Oppo'], ['Vivo'], ['Realme'], ['Asus'], ['ZTE'], ['Nubia'], ['Lenovo'], ['Meizu'], ['Alcatel'], ['TCL'], ['Nothing'], ['Fairphone'], ['Tecno'], ['Infinix'], ['Itel'], ['Sharp'], ['Kyocera'], ['Panasonic'],
      ['Microsoft'], ['Essential'], ['Palm'], ['Acer'], ['CAT', 'Caterpillar'], ['Doogee'], ['Ulefone'], ['Umidigi'], ['Wiko'], ['HMD'], ['BQ'], ['Yota'], ['Vertu'], ['Energizer'], ['Philips'], ['BenQ'], ['Siemens'],
      ['Sony Ericsson'], ['Ericsson'], ['HP', 'Hewlett-Packard', 'Hewlett Packard'], ['Dell'], ['Toshiba'], ['Fujitsu'], ['NEC'],
    ] },
    { id: 'japanese-car-brands', title: 'Car marques from Japanese manufacturers, past or present', answers: [
      ['Toyota'], ['Honda'], ['Nissan'], ['Mazda'], ['Subaru'], ['Suzuki'], ['Mitsubishi'], ['Lexus'], ['Infiniti'], ['Acura'], ['Daihatsu'], ['Isuzu'], ['Mitsuoka'], ['Datsun'], ['Scion'], ['Eunos'], ['Autozam'], ['Prince'],
    ] },
    { id: 'original-faang-companies', title: 'Companies represented by the original FAANG acronym', answers: [
      ['Facebook', 'Meta', 'Meta Platforms'], ['Amazon', 'Amazon.com'], ['Apple', 'Apple Inc'], ['Netflix'], ['Google', 'Alphabet'],
    ] },
    { id: 'volkswagen-brands-2024', title: "Vehicle brands in the Volkswagen Group's ten-brand portfolio in 2024", answers: [
      ['Volkswagen', 'VW', 'Volkswagen Passenger Cars'], ['Volkswagen Commercial Vehicles', 'VW Commercial Vehicles'], ['Škoda'], ['SEAT'], ['CUPRA'], ['Audi'], ['Lamborghini'], ['Bentley'], ['Porsche'], ['Ducati'],
    ] },
    { id: 'quick-service-chains', title: 'Quick-service restaurant chains', answers: [
      ["McDonald's", 'McDonalds', 'Mc Donalds', 'McDonald’s'], ['Burger King'], ['KFC', 'Kentucky Fried Chicken'], ['Subway'], ['Pizza Hut'], ["Domino's", 'Dominos', "Domino's Pizza", 'Dominos Pizza'],
      ['Taco Bell'], ["Wendy's", 'Wendys'], ['Popeyes'], ['Chick-fil-A', 'Chick Fil A', 'Chickfila'], ['Five Guys'], ['Shake Shack'], ['In-N-Out Burger', 'In N Out', 'In-N-Out'], ['Jack in the Box'], ["Arby's", 'Arbys'],
      ['Sonic', 'Sonic Drive-In'], ['Dairy Queen', 'DQ'], ['Little Caesars'], ["Papa John's", 'Papa Johns'], ['Jollibee'], ['Tim Hortons'], ["Dunkin'", 'Dunkin', 'Dunkin Donuts'], ['Chipotle'], ['Panda Express'],
      ["Nando's", 'Nandos'], ['Pret A Manger', 'Pret'], ['Greggs'], ['Whataburger'], ['White Castle'], ["Culver's", 'Culvers'], ['Del Taco'], ["Carl's Jr", 'Carls Jr'], ["Hardee's", 'Hardees'], ['Qdoba'], ["Taco John's", 'Taco Johns'], ['Starbucks'], ['Costa Coffee', 'Costa'], ['Krispy Kreme'],
    ] },
  ]),
  ...theme('literature-books', 'Literature & Books', [
    { id: 'harry-potter-characters', title: 'Characters in Harry Potter', answers: [
      ['Harry Potter', 'Harry'], ['Hermione Granger', 'Hermione'], ['Ron Weasley', 'Ron', 'Ronald Weasley'], ['Albus Dumbledore', 'Dumbledore'], ['Severus Snape', 'Snape'], ['Rubeus Hagrid', 'Hagrid'],
      ['Lord Voldemort', 'Voldemort', 'Tom Riddle', 'Tom Marvolo Riddle'], ['Draco Malfoy', 'Draco'], ['Minerva McGonagall', 'McGonagall', 'Professor McGonagall'], ['Sirius Black', 'Sirius', 'Padfoot'], ['Remus Lupin', 'Lupin', 'Moony'],
      ['Neville Longbottom', 'Neville'], ['Luna Lovegood', 'Luna'], ['Ginny Weasley', 'Ginny', 'Ginevra Weasley'], ['Fred Weasley', 'Fred'], ['George Weasley', 'George'], ['Percy Weasley', 'Percy'], ['Bill Weasley', 'Bill'], ['Charlie Weasley', 'Charlie'],
      ['Molly Weasley', 'Molly'], ['Arthur Weasley', 'Arthur'], ['Lucius Malfoy', 'Lucius'], ['Narcissa Malfoy', 'Narcissa'], ['Bellatrix Lestrange', 'Bellatrix'], ['Cedric Diggory', 'Cedric'], ['Cho Chang', 'Cho'], ['Nymphadora Tonks', 'Tonks'],
      ['Alastor Moody', 'Mad-Eye Moody', 'Mad Eye Moody', 'Moody'], ['Dolores Umbridge', 'Umbridge'], ['Peter Pettigrew', 'Pettigrew', 'Wormtail', 'Scabbers'], ['James Potter', 'Prongs'], ['Lily Potter'], ['Dudley Dursley', 'Dudley'],
      ['Petunia Dursley', 'Petunia'], ['Vernon Dursley', 'Vernon'], ['Dobby'], ['Kreacher'], ['Hedwig'], ['Fawkes'], ['Crookshanks'], ['Buckbeak'], ['Aragog'], ['Nagini'], ['Argus Filch', 'Filch'], ['Gilderoy Lockhart', 'Lockhart'],
      ['Quirinus Quirrell', 'Quirrell'], ['Sybill Trelawney', 'Trelawney'], ['Pomona Sprout', 'Sprout'], ['Filius Flitwick', 'Flitwick'], ['Horace Slughorn', 'Slughorn'], ['Garrick Ollivander', 'Ollivander'], ['Rita Skeeter'], ['Cornelius Fudge', 'Fudge'],
      ['Barty Crouch Jr', 'Barty Crouch Junior'], ['Barty Crouch Sr', 'Barty Crouch Senior'], ['Kingsley Shacklebolt', 'Kingsley'], ['Dean Thomas'], ['Seamus Finnigan', 'Seamus'], ['Lavender Brown'], ['Parvati Patil'], ['Padma Patil'],
      ['Viktor Krum', 'Krum'], ['Fleur Delacour', 'Fleur'], ['Gellert Grindelwald', 'Grindelwald'], ['Aberforth Dumbledore', 'Aberforth'], ['Nearly Headless Nick', 'Nick', 'Sir Nicholas de Mimsy-Porpington'], ['Peeves'], ['Moaning Myrtle', 'Myrtle'],
      ['Fat Friar', 'The Fat Friar'], ['Bloody Baron', 'The Bloody Baron'], ['Grey Lady', 'The Grey Lady', 'Helena Ravenclaw'], ['Godric Gryffindor'], ['Helga Hufflepuff'], ['Rowena Ravenclaw'], ['Salazar Slytherin'], ['Vincent Crabbe', 'Crabbe'], ['Gregory Goyle', 'Goyle'], ['Oliver Wood'], ['Percival Dumbledore'],
    ] },
    { id: 'narnia-books', title: 'Books in The Chronicles of Narnia', answers: [
      ['The Lion, the Witch and the Wardrobe', 'The Lion the Witch and the Wardrobe', 'Lion Witch and Wardrobe'], ['Prince Caspian'], ['The Voyage of the Dawn Treader', 'Voyage of the Dawn Treader'], ['The Silver Chair', 'Silver Chair'],
      ['The Horse and His Boy', 'Horse and His Boy'], ["The Magician's Nephew", 'The Magicians Nephew', 'Magicians Nephew', 'The Magician’s Nephew'], ['The Last Battle', 'Last Battle'],
    ] },
    { id: 'jane-austen-novels', title: 'Completed novels and novellas by Jane Austen', answers: [
      ['Sense and Sensibility', 'Sense & Sensibility'], ['Pride and Prejudice', 'Pride & Prejudice'], ['Mansfield Park'], ['Emma'], ['Northanger Abbey'], ['Persuasion'],
    ] },
    { id: 'orwell-novels', title: 'Novels by George Orwell', answers: [
      ['Burmese Days'], ["A Clergyman's Daughter", 'A Clergymans Daughter', 'Clergymans Daughter', 'A Clergyman’s Daughter'], ['Keep the Aspidistra Flying'], ['Coming Up for Air'], ['Animal Farm'], ['Nineteen Eighty-Four', 'Nineteen Eighty Four', '1984'],
    ] },
    { id: 'first-folio-plays', title: "Plays in Shakespeare's First Folio (1623)", answers: [
      ["All's Well That Ends Well", 'Alls Well That Ends Well'], ['Antony and Cleopatra', 'Antony & Cleopatra'], ['As You Like It'], ['The Comedy of Errors', 'Comedy of Errors'], ['Coriolanus'], ['Cymbeline'], ['Hamlet'],
      ['Henry IV Part I', 'Henry IV Part 1', 'Henry 4 Part 1'], ['Henry IV Part II', 'Henry IV Part 2', 'Henry 4 Part 2'], ['Henry V', 'Henry 5'], ['Henry VI Part I', 'Henry VI Part 1', 'Henry 6 Part 1'], ['Henry VI Part II', 'Henry VI Part 2', 'Henry 6 Part 2'], ['Henry VI Part III', 'Henry VI Part 3', 'Henry 6 Part 3'], ['Henry VIII', 'Henry 8'],
      ['Julius Caesar'], ['King John'], ['King Lear'], ["Love's Labour's Lost", 'Loves Labours Lost', "Love's Labor's Lost", 'Loves Labors Lost'], ['Macbeth'], ['Measure for Measure'], ['The Merchant of Venice', 'Merchant of Venice'], ['The Merry Wives of Windsor', 'Merry Wives of Windsor'],
      ["A Midsummer Night's Dream", 'A Midsummer Nights Dream', 'Midsummer Nights Dream'], ['Much Ado About Nothing'], ['Othello'], ['Richard II', 'Richard 2'], ['Richard III', 'Richard 3'], ['Romeo and Juliet', 'Romeo & Juliet'], ['The Taming of the Shrew', 'Taming of the Shrew'], ['The Tempest', 'Tempest'],
      ['Timon of Athens'], ['Titus Andronicus'], ['Troilus and Cressida'], ['Twelfth Night', '12th Night'], ['The Two Gentlemen of Verona', 'Two Gentlemen of Verona'], ["The Winter's Tale", 'The Winters Tale', 'Winters Tale'],
    ] },
  ]),
];
