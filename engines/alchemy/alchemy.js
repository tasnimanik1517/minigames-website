/* Alchemy Lab engine: mix two elements on the lab table to discover new ones.
 * The recipe book is written by hand: every element has its own emoji, and the order of a pair never matters.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  /* ---------- the recipe book ---------- */
  // Name=emoji. "Name=new~old": a stand-in for newer emoji that older systems (such as Windows 10) cannot draw.
  var EMOJI = {}, OLDER = {};
  ('Water=💧|Fire=🔥|Earth=🌍|Air=💨|Steam=♨️|Mud=🟤|Lava=🟠|Energy=⚡|Mist=🌁|Dust=🧹|Puddle=💦|Heat=🌡️|Mountain=⛰️|Wind=🌬️|' +
   'Pond=🪷~⛲|Lake=🏞️|Ocean=🌊|Wave=🏄|Stone=🪨~🗿|Sand=🏖️|Metal=🔩|Glass=🫙~🔍|Volcano=🌋|Island=🏝️|' +
   'Cloud=☁️|Rain=🌧️|Lightning=🌩️|Storm=⛈️|Tornado=🌪️|Cold=🥶|Ice=🧊|Snow=❄️|Glacier=🏔️|Umbrella=☂️|Hurricane=🌀|Earthquake=📳|' +
   'Sky=🌤️|Sun=☀️|Moon=🌙|Night=🌃|Day=🌞|Star=⭐|Space=🌌|Galaxy=💫|Universe=♾️|Black Hole=🕳️|Planet=🪐|Comet=☄️|Meteor=🌠|' +
   'Eclipse=🌑|Rainbow=🌈|Light=🔆|Explosion=💥|Fireworks=🎆|Sunrise=🌄|Sunset=🌇|Time=⏳|Clock=⏰|Sunglasses=🕶️|' +
   'Clay=🏺|Brick=🧱|Wall=🚧|House=🏠|Village=🏘️|City=🏙️|Castle=🏰|School=🏫|Library=📚|' +
   'Smoke=🌫️|Charcoal=⚫|Diamond=💎|Gold=🪙~🥇|Silver=🥈|Ring=💍|Crown=👑|King=🤴|Queen=👸|' +
   'Tool=🔨|Wheel=🛞~🎡|Box=📦|Paper=📄|Book=📖|Pencil=✏️|Letter=✉️|Paint=🖌️|Art=🎨|' +
   'Life=🧬|Bacteria=🦠|Plant=🌱|Grass=🌿|Meadow=🌼|Tree=🌳|Forest=🌲|Leaf=🍃|Autumn=🍂|Flower=🌸|Sunflower=🌻|Rose=🌹|' +
   'Bouquet=💐|Garden=🌷|Desert=🏜️|Cactus=🌵|Oasis=🌴|Mushroom=🍄|Fruit=🍎|Seed=🌰|Wood=🪵~🪓|Bamboo=🎋|' +
   'Fish=🐟|Frog=🐸|Lizard=🦎|Dinosaur=🦖|Dragon=🐉|Bird=🐦|Egg=🥚|Nest=🪺~🐣|Chicken=🐔|Owl=🦉|Penguin=🐧|Duck=🦆|' +
   'Swan=🦢|Flamingo=🦩|Parrot=🦜|Peacock=🦚|Eagle=🦅|Bat=🦇|Insect=🐛|Bee=🐝|Honey=🍯|Butterfly=🦋|Ladybug=🐞|Ant=🐜|' +
   'Snail=🐌|Shell=🐚|Pearl=🦪|Turtle=🐢|Crab=🦀|Whale=🐳|Dolphin=🐬|Shark=🦈|Octopus=🐙|Coral=🪸~🐠|' +
   'Animal=🐾|Cow=🐄|Horse=🐎|Unicorn=🦄|Giraffe=🦒|Camel=🐫|Goat=🐐|Monkey=🐒|Banana=🍌|Bear=🐻|Panda=🐼|Koala=🐨|' +
   'Pig=🐷|Sheep=🐑|Wool=🧶|Rabbit=🐰|Hedgehog=🦔|Lion=🦁|Tiger=🐯|Crocodile=🐊|Snake=🐍|Spider=🕷️|Dog=🐶|Fox=🦊|' +
   'Wolf=🐺|Cat=🐱|Mouse=🐭|Human=🧑|Love=❤️|Family=👪|Home=🏡|Hut=🛖~⛺|Farmer=👩‍🌾|Tractor=🚜|Cook=👨‍🍳|' +
   'Wheat=🌾|Bread=🍞|Milk=🥛|Cheese=🧀|Tomato=🍅|Pizza=🍕|Sandwich=🥪|Hot Dog=🌭|Burger=🍔|Cake=🍰|Birthday Cake=🎂|' +
   'Cupcake=🧁|Donut=🍩|Cookie=🍪|Ice Cream=🍦|Candy=🍬|Lollipop=🍭|Chocolate=🍫|Juice=🧃|Lemon=🍋|Lemonade=🥤|Tea=🍵|' +
   'Coffee=☕|Vegetable=🥕|Salad=🥗|Soup=🍲|Corn=🌽|Popcorn=🍿|Snowman=☃️|Christmas Tree=🎄|Gift=🎁|Santa=🎅|Pumpkin=🎃|' +
   'Ghost=👻|Magic=🪄~✨|Potion=🧪|Crystal Ball=🔮|Genie=🧞|Wizard=🧙|Fairy=🧚|Mermaid=🧜|Angel=👼|' +
   'Robot=🤖|Alien=👽|UFO=🛸|Astronaut=👩‍🚀|Rocket=🚀|Satellite=🛰️|Airplane=✈️|Car=🚗|Bicycle=🚲|Train=🚂|Boat=⛵|Ship=🚢|' +
   'Engine=⚙️|Electricity=🔌|Light Bulb=💡|Brain=🧠|Computer=💻|Internet=🌐|Email=📧|Phone=📱|Television=📺|Video Game=🎮|' +
   'Movie=🎬|Telescope=🔭|Microscope=🔬|Camera=📷|Photo=🖼️|Selfie=🤳|Emoji=😀|' +
   'Sound=🔊|Voice=🗣️|Music=🎵|Song=🎶|Dance=💃|Guitar=🎸|Drum=🥁|Headphones=🎧|Microphone=🎤|' +
   'Money=💰|Bank=🏦|Shop=🏪|Toy=🪀|Teddy Bear=🧸|Ball=⚽|Kite=🪁|Balloon=🎈|Party=🎉|' +
   'Flour=🥣|Dough=🫓~⚪|Pasta=🍝|Noodles=🍜|Pancake=🥞|Waffle=🧇|Butter=🧈|Croissant=🥐|Baguette=🥖|Salt=🧂|' +
   'Pretzel=🥨|Pie=🥧|Dumpling=🥟|Taco=🌮|Rice=🍚|Burrito=🌯|Sushi=🍣|Curry=🍛|Potato=🥔|Fries=🍟|' +
   'Grapes=🍇|Wine=🍷|Beer=🍺|Champagne=🍾|Orange=🍊|Watermelon=🍉|Pineapple=🍍|Peach=🍑|Pear=🍐|Cherry=🍒|' +
   'Strawberry=🍓|Blueberry=🫐~🔷|Olive=🫒~🟢|Oil=🫗~🍶|Avocado=🥑|Coconut=🥥|Garlic=🧄|Onion=🧅|Bell Pepper=🫑~🍏|Chili=🌶️|' +
   'Cucumber=🥒|Broccoli=🥦|Omelette=🍳|Bacon=🥓|Steak=🥩|Meat=🍖|Bubble Tea=🧋~🍹|Elephant=🐘|Zebra=🦓|Donkey=🫏~🐴|' +
   'Deer=🦌|Kangaroo=🦘|Sloth=🦥|Otter=🦦|Beaver=🦫~🐀|Squirrel=🐿️|Moose=🫎~🐃|Rhino=🦏|Hippo=🦛|Bison=🦬~🐂|' +
   'Orangutan=🦧|Gorilla=🦍|Polar Bear=🐻‍❄️~⛄|Llama=🦙|Turkey=🦃|Jellyfish=🪼~🎐|Squid=🦑|Shrimp=🦐|Lobster=🦞|Starfish=🌟|' +
   'Scorpion=🦂|Worm=🪱~〰️|Mosquito=🦟|Grasshopper=🦗|Potted Plant=🪴~🌺|Clover=🍀|Lavender=🪻~💜|Full Moon=🌕|Knife=🔪|Sword=⚔️|' +
   'Scissors=✂️|Thread=🧵|Needle=🪡~📌|Clothing=👕|Rope=🪢~➰|Chain=⛓️|Lock=🔒|Key=🔑|Magnet=🧲|Battery=🔋|' +
   'Candle=🕯️|Lamp=🪔|Lantern=🏮|Mirror=🪞~📀|Bucket=🪣~🗑️|Shovel=⛏️|Ladder=🪜~🏗️|Saw=🪚~🗡️|Wrench=🔧|Soap=🧼|' +
   'Bubbles=🫧~🔵|Perfume=🧴|Chair=🪑|Bed=🛏️|Sofa=🛋️|Door=🚪|Window=🪟~🌅|Map=🗺️|Compass=🧭|Glasses=👓|' +
   'Necklace=📿|Helmet=⛑️|Hat=👒|Dress=👗|Coat=🧥|Tie=👔|Pants=👖|Scarf=🧣|Gloves=🧤|Socks=🧦|' +
   'Shoes=👟|Tent=🏕️|Apartment=🏢|Skyscraper=🌆|Hotel=🏨|Hospital=🏥|Restaurant=🍽️|Museum=🏛️|Theater=🎭|Circus=🎪|' +
   'Playground=🛝~🎠|Bridge=🌉|Road=🛣️|Statue=🗽|Pyramid=🔺|Temple=🛕|Church=⛪|Mosque=🕌|Synagogue=🕍|University=🎓|' +
   'Factory=🏭|Power Plant=☢️|Airport=🛫|Station=🚉|Anchor=⚓|Tower=🗼|Laboratory=⚗️|Doctor=👨‍⚕️|Teacher=🧑‍🏫|Student=🧑‍🎓|' +
   'Scientist=🧑‍🔬|Engineer=🧑‍🔧|Artist=👨‍🎨|Singer=👨‍🎤|Police=👮|Firefighter=🧑‍🚒|Pilot=🧑‍✈️|Soldier=💂|Shield=🛡️|Knight=♞|' +
   'Pirate=🏴‍☠️~☠️|Baker=🧑‍🍳|Hunter=🏹|Fisherman=🎣|Gardener=🧑‍🌾|Writer=🖋️|Photographer=📸|Musician=🧑‍🎤|Baby=👶|Vampire=🧛|' +
   'Zombie=🧟|Superhero=🦸|Elf=🧝|Troll=🧌~👹|Skeleton=💀|Bone=🦴|Spell Book=📕|Medicine=💊|Blood=🩸|Eye=👁️|' +
   'Atom=⚛️|Plastic=🛍️|Feather=🪶~✒️|Piano=🎹|Violin=🎻|Trumpet=🎺|Saxophone=🎷|Flute=🪈~📯|Banjo=🪕|Accordion=🪗~🎼|' +
   'Radio=📻|Puzzle=🧩|Chess=♟️|Dice=🎲|Cards=🃏|Frisbee=🥏|Trophy=🏆|Medal=🏅|Basketball=🏀|Bowling=🎳|' +
   'Boxing=🥊|Barbecue=🍗|Confetti=🎊|Dream=💭|Motorcycle=🏍️|Truck=🚚|Bus=🚌|Ambulance=🚑|Fire Truck=🚒|Police Car=🚓|' +
   'Taxi=🚕|Race Car=🏎️|Helicopter=🚁|Skateboard=🛹|Roller Skate=🛼~🥾' +
   '|Mango=🥭|Kiwi=🥝|Melon=🍈|Peanut=🥜|Kebab=🥙|Falafel=🧆|Dango=🍡|Whiskey=🥃|Cocktail=🍸|Fondue=🫕~🔘|' +
   'Bagel=🥯|Pudding=🍮|Fortune Cookie=🥠|Maple Syrup=🍁|Skewer=🍢|Sundae=🍨|Bento Box=🍱|Teapot=🫖~⬜|Fork=🍴|' +
   'Spoon=🥄|Chopsticks=🥢|Picnic=🧺|Canned Food=🥫|Paella=🥘|Tamale=🫔~🟣|Mate=🧉|Fish Cake=🍥|Ginger=🫚~🟡|' +
   'Sweet Potato=🍠|Eggplant=🍆|Peas=🫛~💚|Beans=🫘~🔴|Kale=🥬|Shaved Ice=🍧|Onigiri=🍙|Rice Cracker=🍘' +
   '|Pufferfish=🐡|Sponge=🧽|Seal=🦭|Leopard=🐆|Ram=🐏|Hamster=🐹|Rooster=🐓|Chick=🐤|Dove=🕊️|Dodo=🦤~⬛|' +
   'Mammoth=🦣~⏹️|Brontosaurus=🦕|Badger=🦡|Skunk=🦨|Raccoon=🦝|Poodle=🐩|Fly=🪰~🔲|Beetle=🪲~🔳|Cockroach=🪳~⏺️|' +
   'Spider Web=🕸️|Crow=🐦‍⬛~🖤|Canoe=🛶|Yacht=🛥️|Ferry=⛴️|Speedboat=🚤|Life Buoy=🛟~⭕|Diving Mask=🤿|Demon=👿|' +
   'Goblin=👺|Invader=👾' +
   '|Toolbox=🧰|Screwdriver=🪛~🔸|Fire Extinguisher=🧯|Toothbrush=🪥~🔹|Razor=🪒~▪️|Safety Pin=🧷|Boomerang=🪃~🔻|' +
   'Piñata=🪅~✳️|Disco Ball=🪩~💠|Nesting Doll=🪆~👧|Sign=🪧~▫️|Elevator=🛗~◻️|Haunted House=🏚️|Stadium=🏟️|' +
   'Roller Coaster=🎢|SUV=🚙|Semi Truck=🚛|Monorail=🚝|Bullet Train=🚄|Metro=🚇|Tram=🚊|Scooter=🛵|' +
   'Kick Scooter=🛴|Railway=🛤️|Gas Station=⛽|Parachute=🪂~◽|Petri Dish=🧫|Syringe=💉|Bandage=🩹|Stethoscope=🩺|' +
   'X-Ray=🩻~◼️|Abacus=🧮|Ruler=📏|Magnifying Glass=🔎|Flashlight=🔦|Monitor=🖥️|Printer=🖨️|Keyboard=⌨️|' +
   'Computer Mouse=🖱️|Floppy Disk=💾|CD=💿|Video Tape=📼|Video Camera=📹|Movie Camera=🎥|Podcast=🎙️|' +
   'Conga=🪘~🔶|Maracas=🪇~❇️|Calendar=📅|Paperclip=📎|Pin=📍|Pen=🖊️|Crayon=🖍️|Link=🔗|Stopwatch=⏱️' +
   '|Tooth=🦷|Ear=👂|Nose=👃|Tongue=👅|Beard=🧔|Heart=🫀~💓|Lungs=🫁~⏸️|Villain=🦹|Detective=🕵️|' +
   'Construction Worker=👷|Programmer=🧑‍💻|Office Worker=🧑‍💼|Meditation=🧘|Sauna=🧖|Bathtub=🛁|Shower=🚿|' +
   'Toilet=🚽|Plunger=🪠~⏯️|Rugby=🏉|Baseball=⚾|Tennis=🎾|Volleyball=🏐|Ping Pong=🏓|Badminton=🏸|Goal=🥅|Golf=⛳|' +
   'Ski=🎿|Sled=🛷|Curling=🥌|Darts=🎯|Joystick=🕹️|Slot Machine=🎰|Mahjong=🀄|Ice Skate=⛸️|Hockey=🏒|' +
   'Lacrosse=🥍|Cricket=🏏|Fencing=🤺|Gym=🏋️|Kimono=👘|Sari=🥻|Swimsuit=🩱|Shorts=🩳|Flip Flops=🩴~🥿|' +
   'High Heels=👠|Boots=👢|Top Hat=🎩|Cap=🧢|Purse=👛|Handbag=👜|Briefcase=💼|Backpack=🎒|Suitcase=🧳|' +
   'Lipstick=💄|Nail Polish=💅|Comb=🪮~⏭️' +
   '|Shamrock=☘️|Mount Fuji=🗻|Scroll=📜|Skeleton Key=🗝️|Bell=🔔|Scales=⚖️|Hook=🪝~⏮️|Satellite Dish=📡|Mall=🏬|' +
   'Barber Shop=💈|Fan=🪭~🌂|Parasol=⛱️|Goggles=🥽|Face Mask=😷|Smartwatch=⌚|Speaker=🔈|Fax Machine=📠|' +
   'Telephone=☎️|Shopping Cart=🛒|Ribbon=🎀|Mailbox=📮|Cabinet=🗄️|Traffic Light=🚦|Faucet=🚰|Notebook=📔|' +
   'Journal=📓|Newspaper=📰|Flag=🚩|Ticket=🎟️|ID Card=🪪~📇|Credit Card=💳|ATM=🏧|Receipt=🧾|Memo=📝|' +
   'Dollar Bill=💵').split('|').forEach(function (p) {
    var i = p.indexOf('='), v = p.slice(i + 1).split('~');
    EMOJI[p.slice(0, i)] = v[0]; if (v[1]) OLDER[p.slice(0, i)] = v[1];
  });
  var RECIPES = (
   // the four elements
   'Water+Fire=Steam|Water+Earth=Mud|Fire+Earth=Lava|Fire+Air=Energy|Water+Air=Mist|Earth+Air=Dust|Water+Water=Puddle|' +
   'Fire+Fire=Heat|Earth+Earth=Mountain|Air+Air=Wind|' +
   // water and rock
   'Puddle+Water=Pond|Pond+Water=Lake|Lake+Water=Ocean|Ocean+Wind=Wave|Ocean+Air=Wave|Lava+Water=Stone|Lava+Air=Stone|' +
   'Stone+Wind=Sand|Stone+Water=Sand|Stone+Fire=Metal|Stone+Heat=Metal|Sand+Fire=Glass|Sand+Heat=Glass|Lava+Mountain=Volcano|' +
   'Mountain+Fire=Volcano|Volcano+Ocean=Island|Earth+Ocean=Island|' +
   // weather
   'Steam+Air=Cloud|Mist+Air=Cloud|Mist+Wind=Cloud|Cloud+Water=Rain|Cloud+Energy=Lightning|Rain+Lightning=Storm|Cloud+Wind=Storm|' +
   'Wind+Wind=Tornado|Storm+Wind=Tornado|Mountain+Air=Cold|Mountain+Wind=Cold|Water+Cold=Ice|Rain+Cold=Snow|Cloud+Cold=Snow|' +
   'Ice+Mountain=Glacier|Snow+Mountain=Glacier|Rain+Tool=Umbrella|Storm+Ocean=Hurricane|Tornado+Ocean=Hurricane|Earth+Energy=Earthquake|' +
   // sky and space
   'Air+Cloud=Sky|Cloud+Cloud=Sky|Sky+Fire=Sun|Sky+Energy=Sun|Sky+Stone=Moon|Sky+Moon=Night|Sky+Sun=Day|Sun+Moon=Eclipse|' +
   'Night+Energy=Star|Night+Fire=Star|Night+Star=Space|Sky+Star=Space|Star+Star=Galaxy|Space+Star=Galaxy|Galaxy+Galaxy=Universe|' +
   'Space+Time=Universe|Space+Galaxy=Black Hole|Earth+Space=Planet|Stone+Space=Meteor|Ice+Space=Comet|Star+Ice=Comet|' +
   'Rain+Sun=Rainbow|Light+Rain=Rainbow|Sun+Energy=Light|Fire+Energy=Explosion|Explosion+Sky=Fireworks|Sun+Mountain=Sunrise|' +
   'Sun+City=Sunset|Day+Night=Time|Sand+Glass=Time|Time+Metal=Clock|Time+Tool=Clock|Sun+Glass=Sunglasses|' +
   // building
   'Mud+Sand=Clay|Clay+Fire=Brick|Mud+Fire=Brick|Brick+Brick=Wall|Wall+Wall=House|House+House=Village|Village+Village=City|' +
   'King+House=Castle|Wall+King=Castle|Book+House=School|Book+Book=Library|' +
   // treasure
   'Fire+Leaf=Smoke|Fire+Grass=Smoke|Fire+Wood=Charcoal|Charcoal+Volcano=Diamond|Charcoal+Earthquake=Diamond|Metal+Sun=Gold|' +
   'Metal+Rainbow=Gold|Metal+Moon=Silver|Gold+Diamond=Ring|Gold+Star=Crown|Human+Crown=King|King+Love=Queen|' +
   // tools and paper
   'Metal+Stone=Tool|Stone+Tool=Wheel|Wood+Tool=Box|Wood+Water=Paper|Tree+Tool=Wood|Paper+Paper=Book|Wood+Charcoal=Pencil|' +
   'Paper+Pencil=Letter|Rainbow+Water=Paint|Paint+Paper=Art|Human+Paint=Art|' +
   // plants
   'Lightning+Ocean=Life|Lightning+Mud=Life|Life+Water=Bacteria|Life+Mud=Bacteria|Life+Earth=Plant|Rain+Earth=Plant|Seed+Earth=Plant|' +
   'Plant+Plant=Grass|Grass+Grass=Meadow|Plant+Time=Tree|Tree+Tree=Forest|Tree+Air=Leaf|Tree+Wind=Leaf|Leaf+Cold=Autumn|' +
   'Leaf+Wind=Autumn|Plant+Sun=Flower|Flower+Sun=Sunflower|Flower+Love=Rose|Flower+Flower=Bouquet|Flower+Grass=Garden|' +
   'Flower+Meadow=Garden|Sand+Sand=Desert|Plant+Desert=Cactus|Desert+Water=Oasis|Plant+Night=Mushroom|Tree+Flower=Fruit|' +
   'Fruit+Earth=Seed|Grass+Tree=Bamboo|' +
   // animals
   'Life+Ocean=Fish|Life+Lake=Fish|Fish+Mud=Frog|Frog+Earth=Lizard|Lizard+Time=Dinosaur|Lizard+Fire=Dragon|Dinosaur+Fire=Dragon|' +
   'Lizard+Air=Bird|Lizard+Sky=Bird|Bird+Bird=Egg|Bird+Tree=Nest|Egg+Meadow=Chicken|Bird+Night=Owl|Bird+Ice=Penguin|' +
   'Bird+Cold=Penguin|Bird+Pond=Duck|Bird+Lake=Swan|Bird+Rose=Flamingo|Bird+Rainbow=Parrot|Bird+Garden=Peacock|Bird+Mountain=Eagle|' +
   'Mouse+Bird=Bat|Life+Dust=Insect|Bacteria+Earth=Insect|Insect+Flower=Bee|Bee+Flower=Honey|Insect+Rainbow=Butterfly|' +
   'Insect+Garden=Ladybug|Insect+Earth=Ant|Insect+Shell=Snail|Ocean+Stone=Shell|Shell+Sand=Pearl|Lizard+Shell=Turtle|' +
   'Fish+Shell=Crab|Fish+Ocean=Whale|Fish+Wave=Dolphin|Fish+Wolf=Shark|Ocean+Animal=Octopus|Ocean+Plant=Coral|Life+Forest=Animal|' +
   'Animal+Grass=Cow|Animal+Meadow=Horse|Horse+Rainbow=Unicorn|Horse+Tree=Giraffe|Animal+Desert=Camel|Animal+Mountain=Goat|' +
   'Animal+Tree=Monkey|Monkey+Fruit=Banana|Animal+Forest=Bear|Bear+Bamboo=Panda|Bear+Tree=Koala|Animal+Mud=Pig|Animal+Cloud=Sheep|' +
   'Sheep+Tool=Wool|Animal+Vegetable=Rabbit|Animal+Cactus=Hedgehog|Animal+King=Lion|Lion+Forest=Tiger|Lizard+Lake=Crocodile|' +
   'Lizard+Grass=Snake|Insect+Night=Spider|Human+Animal=Dog|Dog+Forest=Fox|Dog+Moon=Wolf|Animal+House=Cat|Cat+Cheese=Mouse|' +
   // people
   'Monkey+Time=Human|Clay+Life=Human|Human+Human=Love|Love+Human=Family|Family+House=Home|Wood+Grass=Hut|Human+Wood=Hut|' +
   'Human+Meadow=Farmer|Farmer+Car=Tractor|Farmer+Engine=Tractor|Human+Fire=Cook|' +
   // food
   'Farmer+Plant=Wheat|Wheat+Fire=Bread|Wheat+Heat=Bread|Cow+Human=Milk|Cow+Farmer=Milk|Milk+Time=Cheese|Fruit+Garden=Tomato|' +
   'Bread+Tomato=Pizza|Bread+Cheese=Sandwich|Dog+Bread=Hot Dog|Dog+Heat=Hot Dog|Bread+Cow=Burger|Bread+Honey=Cake|' +
   'Cake+Fire=Birthday Cake|Cake+Paper=Cupcake|Cake+Ring=Donut|Wheat+Honey=Cookie|Milk+Ice=Ice Cream|Milk+Snow=Ice Cream|' +
   'Honey+Fruit=Candy|Candy+Wood=Lollipop|Candy+Milk=Chocolate|Fruit+Water=Juice|Fruit+Sun=Lemon|Lemon+Water=Lemonade|' +
   'Leaf+Steam=Tea|Plant+Steam=Tea|Seed+Steam=Coffee|Garden+Farmer=Vegetable|Vegetable+Vegetable=Salad|Vegetable+Water=Soup|' +
   'Cook+Vegetable=Soup|Wheat+Sun=Corn|Corn+Heat=Popcorn|Corn+Fire=Popcorn|' +
   // holidays and magic
   'Snow+Human=Snowman|Snow+Snow=Snowman|Tree+Star=Christmas Tree|Tree+Snow=Christmas Tree|Box+Love=Gift|Gift+Human=Santa|' +
   'Christmas Tree+Human=Santa|Fruit+Night=Pumpkin|Human+Mist=Ghost|Rainbow+Energy=Magic|Human+Magic=Wizard|Water+Magic=Potion|' +
   'Glass+Magic=Crystal Ball|Magic+Smoke=Genie|Human+Butterfly=Fairy|Magic+Flower=Fairy|Human+Fish=Mermaid|Human+Bird=Angel|' +
   // machines
   'Metal+Human=Robot|Metal+Life=Robot|Life+Planet=Alien|Life+Space=Alien|Alien+Airplane=UFO|Alien+Rocket=UFO|Human+Space=Astronaut|' +
   'Human+Rocket=Astronaut|Airplane+Space=Rocket|Metal+Explosion=Rocket|Metal+Space=Satellite|Metal+Bird=Airplane|Metal+Wheel=Car|' +
   'Engine+Wheel=Car|Wheel+Wheel=Bicycle|Steam+Car=Train|Wood+Ocean=Boat|Wood+Lake=Boat|Boat+Metal=Ship|Boat+Engine=Ship|' +
   'Metal+Energy=Engine|Lightning+Metal=Electricity|Electricity+Glass=Light Bulb|Light+Glass=Light Bulb|Human+Electricity=Brain|' +
   'Electricity+Brain=Computer|Computer+Computer=Internet|Letter+Internet=Email|Letter+Computer=Email|Electricity+Sound=Phone|' +
   'Computer+Sound=Phone|Electricity+Box=Television|Television+Toy=Video Game|Computer+Toy=Video Game|Photo+Time=Movie|' +
   'Glass+Star=Telescope|Glass+Bacteria=Microscope|Box+Light=Camera|Camera+Paper=Photo|Phone+Human=Selfie|Phone+Love=Emoji|' +
   // sound and fun
   'Air+Wave=Sound|Sound+Human=Voice|Sound+Love=Music|Music+Bird=Song|Voice+Music=Song|Music+Human=Dance|Music+Wood=Guitar|' +
   'Sound+Wood=Drum|Music+Electricity=Headphones|Song+Electricity=Microphone|Gold+Paper=Money|Money+House=Bank|Money+Box=Shop|' +
   'Human+Box=Toy|Bear+Toy=Teddy Bear|Toy+Air=Ball|Toy+Wind=Kite|Paper+Wind=Kite|Love+Air=Balloon|Balloon+Birthday Cake=Party|' +
   'Music+Balloon=Party|Party+Music=Dance|' +
   // cooking and food (expansion)
   'Wheat+Stone=Flour|Flour+Water=Dough|Dough+Egg=Pasta|Pasta+Water=Noodles|Dough+Fire=Pancake|Dough+Metal=Waffle|Milk+Tool=Butter|Dough+Butter=Croissant|Dough+Heat=Baguette|' +
   'Ocean+Sun=Salt|Dough+Salt=Pretzel|Dough+Fruit=Pie|Dough+Vegetable=Dumpling|Dough+Cow=Taco|Plant+Water=Rice|Dough+Rice=Burrito|Rice+Fish=Sushi|Rice+Heat=Curry|' +
   'Vegetable+Earth=Potato|Potato+Fire=Fries|Fruit+Rain=Grapes|Grapes+Time=Wine|Wheat+Time=Beer|Wine+Explosion=Champagne|Fruit+Rainbow=Orange|Fruit+Lake=Watermelon|Fruit+Crown=Pineapple|' +
   'Fruit+Rose=Peach|Fruit+Autumn=Pear|Fruit+Love=Cherry|Fruit+Seed=Strawberry|Fruit+Forest=Blueberry|Tree+Fruit=Olive|Olive+Tool=Oil|Fruit+Stone=Avocado|Fruit+Island=Coconut|' +
   'Plant+Vegetable=Garlic|Vegetable+Leaf=Onion|Vegetable+Rainbow=Bell Pepper|Vegetable+Fire=Chili|Vegetable+Pond=Cucumber|Vegetable+Tree=Broccoli|Egg+Heat=Omelette|Pig+Fire=Bacon|Cow+Fire=Steak|' +
   'Animal+Tool=Meat|Milk+Tea=Bubble Tea|' +
   // animals and creatures (expansion)
   'Animal+Earth=Elephant|Horse+Paint=Zebra|Horse+Earth=Donkey|Animal+Leaf=Deer|Rabbit+Desert=Kangaroo|Animal+Time=Sloth|Animal+Pond=Otter|Animal+Wood=Beaver|Animal+Seed=Squirrel|' +
   'Animal+Snow=Moose|Elephant+Stone=Rhino|Animal+Lake=Hippo|Cow+Grass=Bison|Monkey+Forest=Orangutan|Monkey+Energy=Gorilla|Bear+Snow=Polar Bear|Sheep+Mountain=Llama|Bird+Farmer=Turkey|' +
   'Ocean+Energy=Jellyfish|Fish+Octopus=Squid|Ocean+Insect=Shrimp|Crab+Stone=Lobster|Ocean+Star=Starfish|Spider+Desert=Scorpion|Mud+Insect=Worm|Insect+Lake=Mosquito|Insect+Meadow=Grasshopper|' +
   // plants and sky (expansion)
   'Plant+Clay=Potted Plant|Plant+Magic=Clover|Flower+Night=Lavender|Moon+Light=Full Moon|' +
   // tools and household (expansion)
   'Tool+Metal=Knife|Knife+King=Sword|Paper+Metal=Scissors|Wool+Tool=Thread|Metal+Thread=Needle|Needle+Thread=Clothing|Grass+Tool=Rope|Metal+Metal=Chain|Metal+Box=Lock|' +
   'Lock+Tool=Key|Metal+Earth=Magnet|Metal+Electricity=Battery|Fire+Thread=Candle|Fire+Metal=Lamp|Candle+Paper=Lantern|Glass+Metal=Mirror|Tool+Water=Bucket|Tool+Earth=Shovel|' +
   'Wood+House=Ladder|Metal+Wood=Saw|Tool+Engine=Wrench|Water+Energy=Soap|Soap+Air=Bubbles|Flower+Glass=Perfume|Wood+Stone=Chair|Wood+Night=Bed|Bed+Chair=Sofa|' +
   'Wood+Wall=Door|Wall+Glass=Window|Paper+Earth=Map|Map+Magnet=Compass|Glass+Eye=Glasses|Chain+Gold=Necklace|Metal+Bicycle=Helmet|Clothing+Sun=Hat|Clothing+Flower=Dress|' +
   'Clothing+Cold=Coat|Clothing+King=Tie|Clothing+Stone=Pants|Wool+Cold=Scarf|Wool+Ice=Gloves|Wool+Wool=Socks|Clothing+Earth=Shoes|' +
   // buildings and places (expansion)
   'Wool+Wood=Tent|House+City=Apartment|Apartment+Sky=Skyscraper|Bed+City=Hotel|House+Medicine=Hospital|Cook+House=Restaurant|House+Art=Museum|House+Movie=Theater|Party+Tent=Circus|' +
   'Toy+Tree=Playground|Stone+Lake=Bridge|Stone+Earth=Road|Stone+Human=Statue|Stone+Desert=Pyramid|Stone+House=Temple|House+Angel=Church|House+Moon=Mosque|House+Star=Synagogue|' +
   'School+City=University|House+Engine=Factory|Factory+Energy=Power Plant|Airplane+House=Airport|Train+House=Station|Metal+Ship=Anchor|Castle+Sky=Tower|House+Potion=Laboratory|' +
   // people and fantasy (expansion)
   'Human+Medicine=Doctor|Human+Book=Teacher|Human+School=Student|Human+Laboratory=Scientist|Human+Engine=Engineer|Human+Art=Artist|Human+Song=Singer|Human+Car=Police|Human+Water=Firefighter|' +
   'Human+Airplane=Pilot|Human+Sword=Soldier|King+Metal=Shield|Human+Shield=Knight|Human+Ship=Pirate|Human+Bread=Baker|Human+Forest=Hunter|Human+Boat=Fisherman|Human+Garden=Gardener|' +
   'Human+Pencil=Writer|Human+Camera=Photographer|Human+Guitar=Musician|Love+Family=Baby|Human+Bat=Vampire|Ghost+Human=Zombie|Human+Energy=Superhero|Human+Leaf=Elf|Human+Mountain=Troll|' +
   'Animal+Stone=Bone|Human+Bone=Skeleton|Book+Magic=Spell Book|' +
   // science and nature (expansion)
   'Potion+Life=Medicine|Life+Energy=Blood|Human+Light=Eye|Energy+Stone=Atom|Oil+Energy=Plastic|Bird+Wind=Feather|Atom+Atom=Energy|' +
   // music, games and fun (expansion)
   'Music+Tool=Piano|Guitar+Love=Violin|Music+Metal=Trumpet|Music+Gold=Saxophone|Music+Bamboo=Flute|Guitar+Wood=Banjo|Music+Box=Accordion|Sound+Box=Radio|Toy+Brain=Puzzle|' +
   'Toy+King=Chess|Toy+Box=Dice|Paper+Toy=Cards|Toy+Stone=Frisbee|Gold+Video Game=Trophy|Gold+Ball=Medal|Toy+Orange=Basketball|Ball+Stone=Bowling|Human+Gloves=Boxing|' +
   'Meat+Fire=Barbecue|Party+Paper=Confetti|Night+Human=Dream|' +
   // transport (expansion)
   'Bicycle+Engine=Motorcycle|Car+Box=Truck|Car+City=Bus|Car+Medicine=Ambulance|Car+Water=Fire Truck|Car+Police=Police Car|Car+Money=Taxi|Car+Energy=Race Car|Airplane+Metal=Helicopter|' +
   'Wood+Wheel=Skateboard|Shoes+Wheel=Roller Skate|' +
   // follow-on chains (expansion)
   'Pancake+Chocolate=Cake|Waffle+Chocolate=Cookie|Croissant+Cheese=Sandwich|Baguette+Garlic=Bread|Pretzel+Beer=Party|Pie+Ice Cream=Cake|Dumpling+Water=Soup|Taco+Chili=Burrito|Burrito+Vegetable=Sandwich|' +
   'Sushi+Human=Cook|Curry+Potato=Soup|Fries+Meat=Burger|Beer+Meat=Barbecue|Champagne+Party=Fireworks|Watermelon+Ice=Juice|Pineapple+Coconut=Juice|Peach+Ice=Ice Cream|Pear+Cheese=Salad|' +
   'Cherry+Cake=Birthday Cake|Strawberry+Chocolate=Candy|Blueberry+Dough=Pie|Avocado+Bread=Sandwich|Coconut+Water=Milk|Garlic+Vampire=Human|Onion+Eye=Water|Bell Pepper+Cheese=Pizza|Chili+Chocolate=Candy|' +
   'Cucumber+Water=Juice|Broccoli+Cheese=Soup|Omelette+Bread=Sandwich|Bacon+Egg=Omelette|Steak+Wine=Restaurant|Bubble Tea+Ice=Ice Cream|Zebra+Water=Horse|Donkey+Human=Farmer|Deer+Snow=Santa|' +
   'Kangaroo+Gloves=Boxing|Sloth+Night=Dream|Otter+Shell=Pearl|Beaver+House=Hut|Squirrel+Seed=Tree|Moose+Mountain=Goat|Rhino+Energy=Dinosaur|Hippo+Mud=Pig|Bison+Human=Cow|' +
   'Orangutan+Time=Human|Gorilla+Banana=Monkey|Polar Bear+Sun=Bear|Llama+Wool=Clothing|Turkey+Family=Party|Jellyfish+Energy=Light|Squid+Water=Octopus|Shrimp+Rice=Sushi|Lobster+Butter=Restaurant|' +
   'Starfish+Sky=Star|Scorpion+Magic=Potion|Worm+Rain=Fish|Mosquito+Blood=Vampire|Grasshopper+Violin=Music|Potted Plant+Sun=Flower|Clover+Rainbow=Gold|Lavender+Water=Perfume|Full Moon+Human=Vampire|' +
   'Scissors+Paper=Confetti|Rope+Tree=Playground|Key+Door=House|Battery+Toy=Robot|Lamp+Magic=Genie|Lantern+Sky=Fireworks|Mirror+Phone=Selfie|Bucket+Sand=Castle|Shovel+Earth=Garden|' +
   'Ladder+Cloud=Sky|Saw+Tree=Wood|Wrench+Metal=Tool|Bubbles+Human=Party|Perfume+Love=Party|Sofa+Television=Movie|Window+Sun=Day|Compass+Ocean=Pirate|Glasses+Human=Teacher|' +
   'Necklace+Human=Queen|Helmet+Human=Soldier|Hat+Magic=Rabbit|Dress+Dance=Party|Coat+Snow=Scarf|Tie+Money=Bank|Scarf+Snow=Snowman|Socks+Santa=Gift|Skyscraper+Airplane=Airport|' +
   'Hotel+Water=Island|Hospital+Baby=Family|Restaurant+Human=Cook|Museum+Stone=Statue|Theater+Night=Movie|Circus+Elephant=Party|Playground+Human=Party|Bridge+Train=Station|Road+House=Village|' +
   'Statue+Magic=Human|Pyramid+Human=King|Temple+Magic=Wizard|Church+Human=Angel|Mosque+Sun=Desert|Synagogue+Book=Library|University+Human=Teacher|Power Plant+Energy=Electricity|Airport+Space=Rocket|' +
   'Station+Car=Bus|Anchor+Ocean=Island|Tower+Dragon=Castle|Doctor+Bacteria=Medicine|Teacher+Student=School|Scientist+Space=Astronaut|Engineer+Metal=Robot|Artist+Stone=Statue|Singer+Microphone=Song|' +
   'Firefighter+Fire=Steam|Pilot+Rocket=Astronaut|Soldier+Castle=Knight|Knight+Dragon=King|Pirate+Map=Island|Baker+Flour=Bread|Hunter+Animal=Meat|Fisherman+Ocean=Whale|Gardener+Tree=Forest|' +
   'Writer+Paper=Book|Photographer+Time=Movie|Musician+Radio=Song|Baby+Time=Human|Vampire+Sun=Ghost|Zombie+Human=Ghost|Superhero+Explosion=Fireworks|Elf+Magic=Fairy|Troll+Bridge=Statue|' +
   'Skeleton+Night=Ghost|Spell Book+Magic=Potion|Plastic+Metal=Car|Feather+Paper=Letter|Piano+Human=Musician|Violin+Human=Musician|Trumpet+King=Party|Saxophone+City=Night|Flute+Snake=Music|' +
   'Banjo+Party=Music|Accordion+Wind=Music|Puzzle+Toy=Video Game|Chess+Brain=Computer|Dice+Gold=Money|Cards+Human=Party|Frisbee+Dog=Toy|Trophy+Human=Party|Medal+Human=Soldier|' +
   'Basketball+Human=Trophy|Bowling+Night=Party|Barbecue+Human=Party|Confetti+Birthday Cake=Party|Dream+Night=Ghost|Motorcycle+Police=Police Car|Truck+City=Bus|Bus+Human=City|Ambulance+Doctor=Hospital|' +
   'Fire Truck+Fire=House|Police Car+Human=Police|Taxi+Night=City|Race Car+Fire=Explosion|Helicopter+City=Airport|Skateboard+Human=Toy|Roller Skate+Party=Dance' +
   // round 2: kitchen and world food
   '|Tree+Heat=Mango|Fruit+Grass=Kiwi|Grass+Sun=Melon|Seed+Sand=Peanut|Skewer+Meat=Kebab|Beans+Fire=Falafel|' +
   'Rice+Steam=Dango|Beer+Time=Whiskey|Juice+Ice=Cocktail|Cheese+Fire=Fondue|Dough+Water=Bagel|Milk+Egg=Pudding|' +
   'Cookie+Paper=Fortune Cookie|Tree+Fire=Maple Syrup|Wood+Knife=Skewer|Ice Cream+Chocolate=Sundae|' +
   'Rice+Box=Bento Box|Tea+Clay=Teapot|Knife+Stone=Fork|Metal+Heat=Spoon|Bamboo+Wood=Chopsticks|' +
   'Sandwich+Grass=Picnic|Metal+Vegetable=Canned Food|Rice+Squid=Paella|Corn+Dough=Tamale|Leaf+Tea=Mate|' +
   'Fish+Flour=Fish Cake|Plant+Earth=Ginger|Potato+Sun=Sweet Potato|Plant+Moon=Eggplant|Grass+Seed=Peas|' +
   'Seed+Sun=Beans|Plant+Leaf=Kale|Juice+Snow=Shaved Ice|Rice+Salt=Onigiri|Rice+Fire=Rice Cracker|' +
   'Skewer+Vegetable=Kebab|Ice Cream+Mango=Sundae|Whiskey+Ice=Cocktail|Rice+Milk=Pudding|Dough+Steam=Tamale|' +
   'Mango+Ice=Shaved Ice|Chopsticks+Rice=Bento Box|Peanut+Chocolate=Candy|Peanut+Dough=Cookie|' +
   'Kebab+Bread=Sandwich|Falafel+Bread=Sandwich|Dango+Honey=Candy|Whiskey+Honey=Medicine|Cocktail+Night=Party|' +
   'Fondue+Night=Party|Bagel+Cheese=Pizza|Pudding+Chocolate=Cake|Pudding+Cookie=Pie|' +
   'Fortune Cookie+Crystal Ball=Magic|Fortune Cookie+Paper=Letter|Maple Syrup+Snow=Candy|Skewer+Fire=Barbecue|' +
   'Sundae+Party=Birthday Cake|Bento Box+Fish=Sushi|Bento Box+Train=Picnic|Teapot+Fire=Tea|Fork+Knife=Tool|' +
   'Spoon+Ice Cream=Sundae|Chopsticks+Sushi=Restaurant|Picnic+Wine=Party|Canned Food+Fire=Soup|' +
   'Paella+Lemon=Restaurant|Mate+Fire=Tea|Fish Cake+Soup=Noodles|Fish Cake+Rice=Sushi|Ginger+Tea=Medicine|' +
   'Ginger+Garlic=Curry|Ginger+Dough=Cookie|Sweet Potato+Fire=Fries|Eggplant+Tomato=Curry|Eggplant+Cheese=Pizza|' +
   'Peas+Vegetable=Salad|Peas+Fire=Soup|Beans+Rice=Burrito|Beans+Tomato=Soup|Kale+Fire=Fries|Melon+Meat=Salad|' +
   'Honey+Lemon=Tea|Egg+Butter=Omelette|Tomato+Cheese=Pizza|Oil+Potato=Fries|Milk+Chocolate=Pudding|' +
   'Banana+Milk=Juice|Banana+Fruit=Salad|Lemon+Tea=Lemonade|Fire+Mushroom=Soup|Egg+Tomato=Omelette' +
   // round 2: creatures and sea
   '|Fish+Air=Pufferfish|Coral+Water=Sponge|Otter+Ice=Seal|Tiger+Forest=Leopard|Goat+Mountain=Ram|' +
   'Mouse+Seed=Hamster|Chicken+Sunrise=Rooster|Egg+Time=Chick|Bird+Love=Dove|Bird+Island=Dodo|' +
   'Elephant+Snow=Mammoth|Dinosaur+Plant=Brontosaurus|Fox+Earth=Badger|Animal+Perfume=Skunk|Animal+Night=Raccoon|' +
   'Dog+Scissors=Poodle|Insect+Wind=Fly|Insect+Stone=Beetle|Insect+House=Cockroach|Spider+Thread=Spider Web|' +
   'Bird+Charcoal=Crow|Tree+Water=Canoe|Boat+Money=Yacht|Boat+Car=Ferry|Boat+Energy=Speedboat|' +
   'Plastic+Air=Life Buoy|Glasses+Ocean=Diving Mask|Ghost+Fire=Demon|Elf+Night=Goblin|Alien+Video Game=Invader|' +
   'Elephant+Ice=Mammoth|Chicken+Egg=Chick|Pufferfish+Knife=Sushi|Pufferfish+Water=Fish|Sponge+Soap=Bubbles|' +
   'Sponge+Ocean=Coral|Seal+Ball=Circus|Leopard+Clothing=Dress|Ram+Mountain=Goat|Ram+Sheep=Wool|' +
   'Hamster+Wheel=Energy|Hamster+Seed=Sunflower|Rooster+Chicken=Egg|Rooster+Clock=Sunrise|Chick+Time=Chicken|' +
   'Chick+Grass=Bird|Dove+Magic=Angel|Dove+House=Bird|Dodo+Time=Ghost|Mammoth+Time=Elephant|' +
   'Brontosaurus+Time=Oil|Badger+Forest=Animal|Skunk+Flower=Perfume|Skunk+Water=Soap|Raccoon+City=Animal|' +
   'Raccoon+Forest=Animal|Poodle+Clothing=Dress|Poodle+Water=Dog|Fly+Spider=Spider Web|Fly+Bee=Insect|' +
   'Beetle+Metal=Car|Beetle+Flower=Ladybug|Cockroach+House=Ant|Spider Web+Insect=Spider|Spider Web+House=Ghost|' +
   'Crow+Night=Ghost|Crow+Gold=Ring|Canoe+Water=Boat|Canoe+Fish=Fisherman|Yacht+Night=Party|Ferry+Ocean=Ship|' +
   'Speedboat+Water=Wave|Life Buoy+Ocean=Boat|Diving Mask+Ocean=Coral|Demon+Fire=Explosion|Demon+Night=Vampire|' +
   'Goblin+Gold=Money|Goblin+Forest=Troll|Invader+Computer=Video Game|Invader+Space=Alien|Chicken+Fire=Barbecue|' +
   'Moon+Wolf=Ghost|Night+Spider=Ghost|Horse+Human=Knight|Dog+Human=Family|Fish+Knife=Sushi|Ocean+Turtle=Island|' +
   'Ocean+Whale=Wave|Bee+Tree=Honey|Ant+House=Insect|Butterfly+Flower=Garden|Frog+Magic=King|Ice+Penguin=Snow|' +
   'Crab+Ocean=Sushi|Fire+Lobster=Restaurant' +
   // round 2: home tools and tech
   '|Box+Tool=Toolbox|Knife+Tool=Screwdriver|Metal+Air=Fire Extinguisher|Plastic+Wood=Toothbrush|' +
   'Knife+Plastic=Razor|Metal+Needle=Safety Pin|Air+Wood=Boomerang|Candy+Paper=Piñata|Light+Mirror=Disco Ball|' +
   'Paint+Wood=Nesting Doll|Letter+Wood=Sign|Metal+Skyscraper=Elevator|Ghost+House=Haunted House|' +
   'Ball+City=Stadium|Mountain+Train=Roller Coaster|Car+Mountain=SUV|Engine+Truck=Semi Truck|' +
   'Electricity+Train=Monorail|Lightning+Train=Bullet Train|City+Train=Metro|Road+Train=Tram|' +
   'Bicycle+Electricity=Scooter|Metal+Skateboard=Kick Scooter|Metal+Road=Railway|Car+Oil=Gas Station|' +
   'Air+Umbrella=Parachute|Bacteria+Laboratory=Petri Dish|Glass+Needle=Syringe|Medicine+Thread=Bandage|' +
   'Doctor+Metal=Stethoscope|Camera+Skeleton=X-Ray|Thread+Wood=Abacus|Pencil+Wood=Ruler|' +
   'Book+Glass=Magnifying Glass|Battery+Light Bulb=Flashlight|Computer+Television=Monitor|Computer+Paper=Printer|' +
   'Computer+Piano=Keyboard|Computer+Mouse=Computer Mouse|Computer+Plastic=Floppy Disk|Music+Plastic=CD|' +
   'Movie+Plastic=Video Tape|Camera+Movie=Video Camera|Camera+Time=Movie Camera|Internet+Microphone=Podcast|' +
   'Drum+Wood=Conga|Sand+Wood=Maracas|Paper+Time=Calendar|Needle+Paper=Paperclip|Map+Metal=Pin|' +
   'Feather+Plastic=Pen|Paint+Pencil=Crayon|Chain+Computer=Link|Clock+Metal=Stopwatch|Castle+Ghost=Haunted House|' +
   'Energy+Train=Bullet Train|Apartment+Metal=Elevator|Doctor+Skeleton=X-Ray|Computer+Music=CD|' +
   'Internet+Radio=Podcast|House+Toolbox=Home|Screwdriver+Wrench=Toolbox|Fire+Fire Extinguisher=Smoke|' +
   'Clothing+Safety Pin=Dress|Boomerang+Dog=Toy|Party+Piñata=Candy|Disco Ball+Party=Dance|Disco Ball+Music=Dance|' +
   'Nesting Doll+Paint=Art|Road+Sign=City|Elevator+Skyscraper=Hotel|Elevator+Hotel=Apartment|' +
   'Haunted House+Night=Ghost|Haunted House+Pumpkin=Party|Ball+Stadium=Trophy|Human+Stadium=Party|' +
   'Human+Roller Coaster=Party|Circus+Roller Coaster=Party|Family+SUV=Car|Road+Semi Truck=City|' +
   'City+Monorail=Station|Bullet Train+City=Station|Bullet Train+Energy=Electricity|Metro+Night=City|' +
   'Metro+Station=Train|City+Tram=Road|Road+Scooter=Motorcycle|Human+Kick Scooter=Toy|Railway+Train=Station|' +
   'Car+Gas Station=Road|Human+Parachute=Sky|Bacteria+Petri Dish=Medicine|Doctor+Syringe=Medicine|' +
   'Bandage+Blood=Medicine|Bandage+Doctor=Hospital|Doctor+Stethoscope=Hospital|Doctor+X-Ray=Medicine|' +
   'Abacus+Brain=Computer|Pencil+Ruler=Art|Magnifying Glass+Sun=Fire|Flashlight+Night=Light|' +
   'Flashlight+House=Lamp|Monitor+Television=Movie|Paper+Printer=Book|Paperclip+Paper=Letter|' +
   'Keyboard+Computer=Internet|Computer Mouse+Computer=Video Game|Floppy Disk+Time=Computer|CD+Music=Song|' +
   'CD+Radio=Music|Television+Video Tape=Movie|Human+Video Camera=Movie|Light+Movie Camera=Movie|' +
   'Headphones+Podcast=Music|Conga+Party=Music|Conga+Music=Dance|Maracas+Music=Party|Maracas+Party=Dance|' +
   'Calendar+Clock=Time|Map+Pin=City|Human+Pen=Writer|Crayon+Paper=Art|Internet+Link=Email|' +
   'Race Car+Stopwatch=Trophy|House+Tool=Home|Computer+Human=Robot|Paper+Tree=Book|Camera+Light=Photo|' +
   'Station+Train=City|Car+Road=City|Doctor+Human=Hospital|Boat+Water=Ship|Stone+Stone=Mountain' +
   // round 2: body people sports fashion
   '|Bone+Milk=Tooth|Animal+Sound=Ear|Flower+Human=Nose|Human+Voice=Tongue|Human+Time=Beard|Life+Love=Heart|' +
   'Air+Human=Lungs|Night+Superhero=Villain|Human+Magnifying Glass=Detective|Human+Toolbox=Construction Worker|' +
   'Human+Internet=Programmer|Briefcase+Human=Office Worker|Brain+Time=Meditation|Heat+House=Sauna|' +
   'House+Water=Bathtub|House+Rain=Shower|Chair+House=Toilet|Toilet+Tool=Plunger|Ball+Grass=Rugby|' +
   'Ball+Wood=Baseball|Ball+Wind=Tennis|Ball+Sand=Volleyball|Ball+Plastic=Ping Pong|Ball+Feather=Badminton|' +
   'Metal+Rope=Goal|Grass+Metal=Golf|Shoes+Snow=Ski|Snow+Wood=Sled|Ice+Stone=Curling|Feather+Metal=Darts|' +
   'Plastic+Video Game=Joystick|Metal+Money=Slot Machine|Dragon+Puzzle=Mahjong|Ice+Shoes=Ice Skate|' +
   'Ice+Wood=Hockey|Ball+Rope=Lacrosse|Ball+Bat=Cricket|Knight+Sword=Fencing|House+Metal=Gym|Dress+Flower=Kimono|' +
   'Clothing+Gold=Sari|Clothing+Water=Swimsuit|Pants+Scissors=Shorts|Sand+Shoes=Flip Flops|' +
   'Dress+Shoes=High Heels|Rain+Shoes=Boots|Hat+Party=Top Hat|Hat+Sun=Cap|Handbag+Money=Purse|' +
   'Clothing+Metal=Handbag|Money+Suitcase=Briefcase|Clothing+School=Backpack|Box+Clothing=Suitcase|' +
   'Mirror+Paint=Lipstick|Glass+Paint=Nail Polish|Mirror+Plastic=Comb|Magnifying Glass+Night=Detective|' +
   'House+Soap=Bathtub|Doctor+Tooth=Medicine|Time+Tooth=Bone|Ear+Music=Headphones|Ear+Human=Sound|' +
   'Flower+Nose=Perfume|Tongue+Voice=Song|Beard+Magic=Wizard|Beard+Human=King|Doctor+Heart=Medicine|' +
   'Heart+Love=Family|Air+Lungs=Voice|Lungs+Water=Bubbles|Explosion+Villain=Superhero|Night+Villain=Ghost|' +
   'Detective+Night=Police|Book+Detective=Movie|Construction Worker+Metal=Skyscraper|' +
   'Construction Worker+Wood=House|Computer+Programmer=Robot|Computer+Office Worker=Email|' +
   'Office Worker+Paper=Letter|Meditation+Night=Dream|Sauna+Water=Steam|Bathtub+Soap=Bubbles|Bathtub+Duck=Toy|' +
   'Shower+Water=Rain|Human+Rugby=Trophy|Baseball+Stadium=Trophy|Stadium+Tennis=Party|Sand+Volleyball=Party|' +
   'Human+Ping Pong=Toy|Badminton+Human=Toy|Goal+Human=Trophy|Golf+Human=Party|Mountain+Ski=Snow|Santa+Sled=Gift|' +
   'Darts+Human=Party|Joystick+Video Game=Computer|Human+Joystick=Video Game|Money+Slot Machine=Gold|' +
   'Family+Mahjong=Party|Human+Ice Skate=Dance|Hockey+Human=Trophy|Human+Lacrosse=Party|Cricket+Stadium=Trophy|' +
   'Fencing+Sword=Knight|Fencing+Human=Soldier|Doctor+Gym=Medicine|Human+Kimono=Party|Flower+Kimono=Dress|' +
   'Human+Sari=Dress|Ocean+Swimsuit=Wave|Flip Flops+Water=Shoes|Dress+High Heels=Party|Boots+Rain=Puddle|' +
   'Magic+Top Hat=Rabbit|Human+Top Hat=King|Cap+Sun=Sunglasses|Handbag+Party=Dress|Money+Purse=Bank|' +
   'Airplane+Suitcase=Airport|Hotel+Suitcase=Apartment|Human+Lipstick=Party|Nail Polish+Party=Dress|' +
   'Comb+Mirror=Perfume|Backpack+School=Student|Backpack+Mountain=Tent|Baby+Doctor=Hospital|King+Queen=Family|' +
   'Ball+Human=Toy|Stone+Sword=King|Doctor+Time=Medicine|Baby+Love=Family|Human+House=Family|Human+Money=Bank|' +
   'Human+Star=Superhero|Human+Ice=Snowman' +
   // round 2: nature places everyday
   '|Clover+Rain=Shamrock|Island+Mountain=Mount Fuji|Letter+Time=Scroll|Key+Skeleton=Skeleton Key|' +
   'Church+Metal=Bell|Gold+Metal=Scales|Fish+Metal=Hook|Metal+Satellite=Satellite Dish|City+Shop=Mall|' +
   'Scissors+Shop=Barber Shop|Bamboo+Paper=Fan|Sun+Umbrella=Parasol|Glasses+Water=Goggles|' +
   'Clothing+Doctor=Face Mask|Clock+Phone=Smartwatch|Metal+Sound=Speaker|Paper+Phone=Fax Machine|' +
   'Electricity+Voice=Telephone|Box+Wheel=Shopping Cart|Clothing+Scissors=Ribbon|Box+Letter=Mailbox|' +
   'Box+Wood=Cabinet|Electricity+Road=Traffic Light|Metal+Water=Faucet|Paper+School=Notebook|Book+Night=Journal|' +
   'Day+Paper=Newspaper|Clothing+Wind=Flag|Movie+Paper=Ticket|Human+Paper=ID Card|Money+Plastic=Credit Card|' +
   'Bank+Metal=ATM|Paper+Shop=Receipt|Brain+Paper=Memo|Money+Paper=Dollar Bill|Church+Time=Bell|' +
   'Clock+Computer=Smartwatch|Phone+Time=Telephone|Paper+Train=Ticket|Bank+Computer=ATM|Rain+Shamrock=Rainbow|' +
   'Gold+Shamrock=Money|Mount Fuji+Tree=Garden|Cloud+Mount Fuji=Sky|Magic+Scroll=Spell Book|Book+Scroll=Library|' +
   'Door+Skeleton Key=House|Lock+Skeleton Key=Door|Bell+Time=Clock|Bell+Music=Song|Gold+Scales=Bank|' +
   'Hook+Fish=Fisherman|Hook+Rope=Anchor|Satellite+Satellite Dish=Space|Satellite Dish+Television=Movie|' +
   'Mall+Shop=City|Human+Mall=Party|Barber Shop+Mirror=Comb|Barber Shop+House=Shop|Air+Fan=Wind|' +
   'Parasol+Rain=Umbrella|Goggles+Snow=Ski|Goggles+Ocean=Diving Mask|Doctor+Face Mask=Hospital|' +
   'Bacteria+Face Mask=Medicine|Smartwatch+Time=Clock|Phone+Smartwatch=Computer|Music+Speaker=Party|' +
   'Radio+Speaker=Music|Fax Machine+Paper=Letter|Fax Machine+Time=Email|Human+Telephone=Voice|' +
   'Shop+Shopping Cart=Money|Human+Shopping Cart=Shop|Gift+Ribbon=Party|Dress+Ribbon=Party|Letter+Mailbox=Email|' +
   'Human+Mailbox=Letter|Book+Cabinet=Library|Cabinet+Door=House|Car+Traffic Light=Road|Road+Traffic Light=City|' +
   'Faucet+House=Bathtub|Notebook+Pencil=Book|Human+Notebook=Writer|Journal+Night=Dream|Journal+Time=Book|' +
   'Human+Newspaper=Student|Fire+Newspaper=Smoke|Castle+Flag=King|Confetti+Flag=Party|Station+Ticket=Train|' +
   'Airplane+Ticket=Airport|Human+ID Card=Police|Bank+ID Card=Money|Credit Card+Money=Bank|' +
   'Credit Card+Shop=Money|ATM+Human=Money|Money+Receipt=Shop|Human+Memo=Student|Letter+Memo=Paper|' +
   'Bank+Dollar Bill=Money|Dollar Bill+Gold=Bank|House+Tree=Garden|Book+Tree=Library|Bank+Money=Gold|' +
   'Human+Shop=Money' +
   // round 2: cross combos
   '|Moon+Star=Night|Cloud+Mountain=Snow|Smoke+Air=Cloud|Ice+Ocean=Glacier|Dog+Sheep=Wool|Cat+Fish=Animal|' +
   'Flour+Fire=Bread|Fire+Milk=Cheese|Fire+Tomato=Soup|Chocolate+Coffee=Cake|Grapes+Sun=Juice|Moon+Ocean=Wave|' +
   'Computer+Book=Internet|Car+Fire=Explosion|Moon+Rocket=Space|Dragon+Wizard=Magic|Rainbow+Unicorn=Magic|' +
   'Fairy+Flower=Garden|Human+Skeleton=Ghost|Ghost+Zombie=Night|Ocean+Pirate=Ship|Farmer+Wheat=Bread|' +
   'Doctor+Plant=Medicine|Atom+Scientist=Energy|Airplane+Pilot=Sky|Castle+Knight=King|Guitar+Musician=Song|' +
   'Gift+Santa=Christmas Tree|Fire+Pumpkin=Ghost|Fire+Snowman=Puddle|Brain+Computer=Robot|Drum+Party=Music|' +
   'Headphones+Music=Song|Noodles+Water=Soup|Cheese+Wine=Party|Champagne+Night=Party|Egg+Vegetable=Omelette|' +
   'Beaver+Tree=Wood|Flower+Potted Plant=Garden|Flower+Lavender=Perfume|King+Sword=Knight|Candle+Fire=Lamp|' +
   'Lamp+Night=Light|Human+Mirror=Selfie|Cold+Scarf=Snowman|Apartment+City=Skyscraper|Art+Museum=Statue|' +
   'Circus+Human=Party|Student+University=Teacher|Factory+Metal=Car|City+Power Plant=Electricity|Key+Lock=Door|' +
   'Bed+Night=Dream|Glasses+Sun=Sunglasses|Snow+Volcano=Water|Fire+Life=Energy|Desert+Night=Cactus|' +
   'Forest+Night=Owl|House+Snow=Christmas Tree|Honey+Tea=Medicine|Orange+Water=Juice|Cheese+Rice=Curry').split('|');
  var BOOK = {}, USED = {};
  function pairKey(a, b) { return a < b ? a + '+' + b : b + '+' + a; }
  RECIPES.forEach(function (r) {
    var m = r.split('='), ab = m[0].split('+');
    BOOK[pairKey(ab[0], ab[1])] = m[1]; USED[ab[0]] = USED[ab[1]] = 1;
  });
  var ALL = Object.keys(EMOJI), BASE = ['Water', 'Fire', 'Earth', 'Air'];

  /* ---------- fizzle: what a mix with no recipe of its own falls back to ---------- */
  // Byproducts are not discoveries. They join EMOJI (so cards and saved tables can render
  // them) only now that ALL has counted the real elements, and they never enter `found`:
  // the counter, the chip list, hints and the win check only ever see the recipe book.
  var BYPRODUCT = {};
  ('Mixture=♻️|Sludge=💩|Goo=🫠~😶|Vapor=😶‍🌫️~🫥|Cinders=🧨|Essence=🧿|Shards=✴️|Pulp=🟧|Dust Pile=🟫|Murk=🌚').split('|').forEach(function (p) {
    var i = p.indexOf('='), v = p.slice(i + 1).split('~'), n = p.slice(0, i);
    EMOJI[n] = v[0]; if (v[1]) OLDER[n] = v[1]; BYPRODUCT[n] = 1;
  });
  // Every element has one nature; the pair of natures decides the byproduct.
  var TAGLIST = {
    liquid: 'Water|Puddle|Pond|Lake|Ocean|Wave|Rain|Paint|Oil|Soap|Perfume|Nail Polish',
    fire: 'Fire|Lava|Heat|Volcano|Explosion|Fireworks|Candle|Lamp|Lantern',
    earth: 'Earth|Mud|Dust|Mountain|Earthquake|Desert',
    air: 'Air|Steam|Mist|Wind|Cloud|Storm|Tornado|Hurricane|Sky|Night|Day|Rainbow|Sunrise|Sunset|Smoke|Sound|Voice|Music|Song|Balloon|Bubbles',
    energy: 'Energy|Lightning|Sun|Moon|Star|Space|Galaxy|Universe|Black Hole|Planet|Comet|Meteor|Eclipse|Light|Time|Electricity|Full Moon|Atom',
    plant: 'Plant|Grass|Meadow|Tree|Forest|Leaf|Autumn|Flower|Sunflower|Rose|Bouquet|Garden|Cactus|Mushroom|Fruit|Seed|Bamboo|Wheat|Christmas Tree|Potted Plant|Clover|Lavender|Shamrock',
    animal: 'Life|Bacteria|Fish|Frog|Lizard|Dinosaur|Bird|Egg|Chicken|Owl|Penguin|Duck|Swan|Flamingo|Parrot|Peacock|Eagle|Bat|Insect|Bee|Butterfly|Ladybug|Ant|Snail|Turtle|Crab|Whale|Dolphin|Shark|Octopus|Coral|Animal|Cow|Horse|Giraffe|Camel|Goat|Monkey|Bear|Panda|Koala|Pig|Sheep|Rabbit|Hedgehog|Lion|Tiger|Crocodile|Snake|Spider|Dog|Fox|Wolf|Cat|Mouse|Alien|Elephant|Zebra|Donkey|Deer|Kangaroo|Sloth|Otter|Beaver|Squirrel|Moose|Rhino|Hippo|Bison|Orangutan|Gorilla|Polar Bear|Llama|Turkey|Jellyfish|Squid|Shrimp|Lobster|Starfish|Scorpion|Worm|Mosquito|Grasshopper|Skeleton|Bone|Feather|Pufferfish|Sponge|Seal|Leopard|Ram|Hamster|Rooster|Chick|Dove|Dodo|Mammoth|Brontosaurus|Badger|Skunk|Raccoon|Poodle|Fly|Beetle|Cockroach|Spider Web|Crow',
    human: 'King|Queen|Art|Human|Love|Family|Farmer|Cook|Gift|Santa|Astronaut|Brain|Dance|Party|Doctor|Teacher|Student|Scientist|Engineer|Artist|Singer|Police|Firefighter|Pilot|Soldier|Knight|Pirate|Baker|Hunter|Fisherman|Gardener|Writer|Photographer|Musician|Baby|Blood|Eye|Picnic|Tooth|Ear|Nose|Tongue|Beard|Heart|Lungs|Detective|Construction Worker|Programmer|Office Worker|Meditation',
    food: 'Honey|Banana|Bread|Milk|Cheese|Tomato|Pizza|Sandwich|Hot Dog|Burger|Cake|Birthday Cake|Cupcake|Donut|Cookie|Ice Cream|Candy|Lollipop|Chocolate|Juice|Lemon|Lemonade|Tea|Coffee|Vegetable|Salad|Soup|Corn|Popcorn|Pumpkin|Flour|Dough|Pasta|Noodles|Pancake|Waffle|Butter|Croissant|Baguette|Pretzel|Pie|Dumpling|Taco|Rice|Burrito|Sushi|Curry|Potato|Fries|Grapes|Wine|Beer|Champagne|Orange|Watermelon|Pineapple|Peach|Pear|Cherry|Strawberry|Blueberry|Olive|Avocado|Coconut|Garlic|Onion|Bell Pepper|Chili|Cucumber|Broccoli|Omelette|Bacon|Steak|Meat|Bubble Tea|Barbecue|Mango|Kiwi|Melon|Peanut|Kebab|Falafel|Dango|Whiskey|Cocktail|Fondue|Bagel|Pudding|Fortune Cookie|Maple Syrup|Sundae|Bento Box|Canned Food|Paella|Tamale|Mate|Fish Cake|Ginger|Sweet Potato|Eggplant|Peas|Beans|Kale|Shaved Ice|Onigiri|Rice Cracker',
    metal: 'Metal|Gold|Silver|Ring|Crown|Tool|Money|Knife|Sword|Scissors|Needle|Chain|Lock|Key|Magnet|Bucket|Shovel|Saw|Wrench|Compass|Necklace|Anchor|Shield|Trumpet|Saxophone|Fork|Spoon|Toolbox|Screwdriver|Razor|Safety Pin|Skeleton Key|Bell|Scales|Hook|Shopping Cart|Mailbox|Faucet|Credit Card|ATM|Dollar Bill',
    mineral: 'Stone|Sand|Glass|Sunglasses|Clay|Brick|Wall|Charcoal|Diamond|Shell|Pearl|Salt|Mirror|Glasses|Teapot|Disco Ball|Petri Dish|Syringe|Magnifying Glass',
    wood: 'Wheel|Box|Paper|Book|Pencil|Letter|Wood|Nest|Guitar|Drum|Ladder|Chair|Bed|Sofa|Door|Window|Map|Piano|Violin|Flute|Banjo|Accordion|Puzzle|Chess|Cards|Confetti|Skewer|Chopsticks|Boomerang|Piñata|Nesting Doll|Sign|Abacus|Ruler|Conga|Maracas|Calendar|Paperclip|Pin|Pen|Crayon|Mahjong|Scroll|Fan|Cabinet|Notebook|Journal|Newspaper|Ticket|ID Card|Receipt|Memo',
    cloth: 'Umbrella|Wool|Kite|Thread|Clothing|Rope|Hat|Dress|Coat|Tie|Pants|Scarf|Gloves|Socks|Shoes|Tent|Life Buoy|Diving Mask|Parachute|Bandage|Kimono|Sari|Swimsuit|Shorts|Flip Flops|High Heels|Boots|Top Hat|Cap|Purse|Handbag|Briefcase|Backpack|Suitcase|Parasol|Goggles|Face Mask|Ribbon|Flag',
    machine: 'Clock|Tractor|Robot|UFO|Rocket|Satellite|Airplane|Car|Bicycle|Train|Boat|Ship|Engine|Light Bulb|Computer|Internet|Email|Phone|Television|Video Game|Movie|Telescope|Microscope|Camera|Photo|Selfie|Emoji|Headphones|Microphone|Toy|Teddy Bear|Ball|Battery|Helmet|Medicine|Plastic|Radio|Dice|Frisbee|Trophy|Medal|Basketball|Bowling|Boxing|Motorcycle|Truck|Bus|Ambulance|Fire Truck|Police Car|Taxi|Race Car|Helicopter|Skateboard|Roller Skate|Canoe|Yacht|Ferry|Speedboat|Invader|Fire Extinguisher|Toothbrush|Elevator|Roller Coaster|SUV|Semi Truck|Monorail|Bullet Train|Metro|Tram|Scooter|Kick Scooter|Stethoscope|X-Ray|Flashlight|Monitor|Printer|Keyboard|Computer Mouse|Floppy Disk|CD|Video Tape|Video Camera|Movie Camera|Podcast|Link|Stopwatch|Plunger|Rugby|Baseball|Tennis|Volleyball|Ping Pong|Badminton|Goal|Golf|Ski|Sled|Curling|Darts|Joystick|Slot Machine|Ice Skate|Hockey|Lacrosse|Cricket|Fencing|Gym|Lipstick|Comb|Satellite Dish|Smartwatch|Speaker|Fax Machine|Telephone|Traffic Light',
    magic: 'Dragon|Unicorn|Ghost|Magic|Potion|Crystal Ball|Genie|Wizard|Fairy|Mermaid|Angel|Vampire|Zombie|Superhero|Elf|Troll|Spell Book|Dream|Demon|Goblin|Villain',
    cold: 'Cold|Ice|Snow|Glacier|Snowman',
    place: 'Island|House|Village|City|Castle|School|Library|Oasis|Home|Hut|Bank|Shop|Apartment|Skyscraper|Hotel|Hospital|Restaurant|Museum|Theater|Circus|Playground|Bridge|Road|Statue|Pyramid|Temple|Church|Mosque|Synagogue|University|Factory|Power Plant|Airport|Station|Tower|Laboratory|Haunted House|Stadium|Railway|Gas Station|Sauna|Bathtub|Shower|Toilet|Mount Fuji|Mall|Barber Shop'
  };
  var TAGS = {};
  Object.keys(TAGLIST).forEach(function (t) { TAGLIST[t].split('|').forEach(function (n) { TAGS[n] = t; }); });
  var FIZZ = {};
  ('air+air=Vapor|air+animal=Mixture|air+cloth=Mixture|air+cold=Vapor|air+earth=Dust Pile|air+energy=Vapor|air+fire=Vapor|air+food=Dust Pile|' +
   'air+human=Mixture|air+liquid=Vapor|air+machine=Mixture|air+magic=Essence|air+metal=Mixture|air+mineral=Dust Pile|air+mix=Mixture|air+place=Vapor|' +
   'air+plant=Dust Pile|air+wood=Dust Pile|animal+animal=Goo|animal+cloth=Mixture|animal+cold=Mixture|animal+earth=Mixture|animal+energy=Essence|' +
   'animal+fire=Cinders|animal+food=Mixture|animal+human=Mixture|animal+liquid=Sludge|animal+machine=Mixture|animal+magic=Essence|animal+metal=Mixture|' +
   'animal+mineral=Mixture|animal+mix=Mixture|animal+place=Mixture|animal+plant=Pulp|animal+wood=Mixture|cloth+cloth=Pulp|cloth+cold=Mixture|' +
   'cloth+earth=Dust Pile|cloth+energy=Essence|cloth+fire=Cinders|cloth+food=Goo|cloth+human=Mixture|cloth+liquid=Goo|cloth+machine=Mixture|' +
   'cloth+magic=Essence|cloth+metal=Mixture|cloth+mineral=Dust Pile|cloth+mix=Mixture|cloth+place=Dust Pile|cloth+plant=Pulp|cloth+wood=Pulp|' +
   'cold+cold=Sludge|cold+earth=Murk|cold+energy=Essence|cold+fire=Vapor|cold+food=Goo|cold+human=Mixture|cold+liquid=Sludge|cold+machine=Mixture|' +
   'cold+magic=Murk|cold+metal=Mixture|cold+mineral=Dust Pile|cold+mix=Murk|cold+place=Dust Pile|cold+plant=Pulp|cold+wood=Shards|earth+earth=Dust Pile|' +
   'earth+energy=Essence|earth+fire=Sludge|earth+food=Pulp|earth+human=Mixture|earth+liquid=Sludge|earth+machine=Dust Pile|earth+magic=Essence|' +
   'earth+metal=Dust Pile|earth+mineral=Dust Pile|earth+mix=Mixture|earth+place=Dust Pile|earth+plant=Pulp|earth+wood=Dust Pile|energy+energy=Essence|' +
   'energy+fire=Cinders|energy+food=Essence|energy+human=Essence|energy+liquid=Vapor|energy+machine=Shards|energy+magic=Essence|energy+metal=Shards|' +
   'energy+mineral=Essence|energy+mix=Mixture|energy+place=Essence|energy+plant=Essence|energy+wood=Essence|fire+fire=Cinders|fire+food=Cinders|' +
   'fire+human=Cinders|fire+liquid=Vapor|fire+machine=Shards|fire+magic=Essence|fire+metal=Sludge|fire+mineral=Sludge|fire+mix=Cinders|fire+place=Cinders|' +
   'fire+plant=Cinders|fire+wood=Cinders|food+food=Goo|food+human=Mixture|food+liquid=Goo|food+machine=Mixture|food+magic=Essence|food+metal=Mixture|' +
   'food+mineral=Mixture|food+mix=Mixture|food+place=Mixture|food+plant=Mixture|food+wood=Pulp|human+human=Mixture|human+liquid=Mixture|' +
   'human+machine=Mixture|human+magic=Essence|human+metal=Mixture|human+mineral=Mixture|human+mix=Mixture|human+place=Mixture|human+plant=Mixture|' +
   'human+wood=Mixture|liquid+liquid=Mixture|liquid+machine=Sludge|liquid+magic=Essence|liquid+metal=Sludge|liquid+mineral=Sludge|liquid+mix=Sludge|' +
   'liquid+place=Sludge|liquid+plant=Goo|liquid+wood=Goo|machine+machine=Shards|machine+magic=Essence|machine+metal=Shards|machine+mineral=Shards|' +
   'machine+mix=Mixture|machine+place=Shards|machine+plant=Shards|machine+wood=Shards|magic+magic=Essence|magic+metal=Essence|magic+mineral=Essence|' +
   'magic+mix=Essence|magic+place=Essence|magic+plant=Essence|magic+wood=Essence|metal+metal=Shards|metal+mineral=Shards|metal+mix=Mixture|' +
   'metal+place=Shards|metal+plant=Shards|metal+wood=Shards|mineral+mineral=Dust Pile|mineral+mix=Mixture|mineral+place=Dust Pile|mineral+plant=Pulp|' +
   'mineral+wood=Dust Pile|mix+mix=Mixture|mix+place=Mixture|mix+plant=Mixture|mix+wood=Mixture|place+place=Dust Pile|place+plant=Pulp|' +
   'place+wood=Dust Pile|plant+plant=Pulp|plant+wood=Pulp|wood+wood=Shards').split('|').forEach(function (r) { var m = r.split('='); FIZZ[m[0]] = m[1]; });
  function tagOf(name) { return BYPRODUCT[name] ? 'mix' : (TAGS[name] || 'mix'); }
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

  // An emoji this device cannot draw comes out as a plain box in the text colour; colour emoji never do.
  function canDraw(e) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 28;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.font = '22px ' + EMOJI_FONT; x.textBaseline = 'top'; x.fillStyle = '#0000ff'; x.fillText(e, 2, 2);
      var d = x.getImageData(0, 0, 28, 28).data;
      for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 60 && (d[i] > 70 || d[i + 1] > 70)) return true;
      return false;
    } catch (err) { return true; }
  }
  Object.keys(OLDER).forEach(function (n) { if (!canDraw(EMOJI[n])) EMOJI[n] = OLDER[n]; });

  /* ---------- state ---------- */
  var saved = MG.store.get('found', null), found = [];
  BASE.concat(Array.isArray(saved) ? saved : []).forEach(function (n) { if (EMOJI[n] && found.indexOf(n) < 0) found.push(n); });
  var items = [], nextId = 1, selected = null, query = '', fresh = {}, kbd = false;
  var sortMode = MG.store.get('sort', 'az') === 'new' ? 'new' : 'az';

  /* ---------- DOM ---------- */
  var countEl = h('b');
  var countPill = h('span', { class: 'mg-pill al-count', title: 'Elements found' }, h('small', { text: 'Found' }), countEl);
  var hintBtn = h('button', { class: 'al-btn', type: 'button', 'aria-label': 'Hint', html: '<span aria-hidden="true">💡</span><i>Hint</i>' });
  var clearBtn = h('button', { class: 'al-btn', type: 'button', 'aria-label': 'Clear the table', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/></svg><i>Clear</i>' });
  var resetBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Start over', title: 'Start over',
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v5h5"/></svg>' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var labHint = h('p', { class: 'al-labhint' });
  var banner = h('div', { class: 'al-banner', 'aria-live': 'polite' });
  var lab = h('div', { class: 'al-lab', role: 'region', 'aria-label': 'Lab table' }, labHint, banner);
  var search = h('input', { class: 'al-search', type: 'search', placeholder: 'Search', 'aria-label': 'Search your elements', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search' });
  var sortBtn = h('button', { class: 'al-sort', type: 'button' });
  var listEl = h('div', { class: 'al-list', role: 'group', 'aria-label': 'Your elements' });
  var side = h('div', { class: 'al-side' }, h('div', { class: 'al-tools' }, search, sortBtn), listEl);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root al' },
    h('div', { class: 'mg-hud' }, countPill, h('span', { class: 'mg-spacer' }), hintBtn, clearBtn, resetBtn, soundBtn),
    h('div', { class: 'al-body' }, lab, side), overlay);
  document.getElementById('game').append(root);

  function card(name) {
    return h('span', { class: 'al-card' }, h('span', { class: 'al-emoji', 'aria-hidden': 'true', text: EMOJI[name] }), h('span', { class: 'al-name', text: name }));
  }

  /* ---------- the list of discovered elements ---------- */
  function chip(name) {
    var fin = !USED[name];
    return h('button', { class: 'al-chip' + (fresh[name] ? ' is-new' : '') + (fin ? ' is-final' : ''), type: 'button', 'data-name': name,
      title: fin ? name + ': a final element, no recipe makes or uses it' : name, 'aria-label': name + (fin ? ', final element' : '') },
      h('span', { class: 'al-emoji', 'aria-hidden': 'true', text: EMOJI[name] }), h('span', { class: 'al-name', text: name }));
  }
  function renderList() {
    var q = query.trim().toLowerCase(), list = found.slice(), frag = document.createDocumentFragment(), n = 0;
    if (sortMode === 'az') list.sort(function (a, b) { return a < b ? -1 : 1; }); else list.reverse();
    list.forEach(function (name) { if (!q || name.toLowerCase().indexOf(q) >= 0) { frag.append(chip(name)); n++; } });
    listEl.innerHTML = '';
    if (!n) frag.append(h('p', { class: 'al-empty', text: 'Nothing here yet. Keep mixing!' }));
    listEl.append(frag);
    countEl.textContent = found.length + ' / ' + ALL.length;
    sortBtn.textContent = sortMode === 'az' ? 'A–Z' : 'Newest';
    sortBtn.setAttribute('aria-label', 'Order: ' + (sortMode === 'az' ? 'A to Z' : 'newest first') + '. Change order');
  }
  function chipFor(name) { return listEl.querySelector('[data-name="' + name + '"]'); }
  function reveal(c) { // scroll the list (only the list, never the page) so the chip is visible
    var lr = listEl.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (cr.top < lr.top) listEl.scrollTop += cr.top - lr.top - 8; else if (cr.bottom > lr.bottom) listEl.scrollTop += cr.bottom - lr.bottom + 8;
    if (cr.left < lr.left) listEl.scrollLeft += cr.left - lr.left - 8; else if (cr.right > lr.right) listEl.scrollLeft += cr.right - lr.right + 8;
  }
  function useChip(name) { if (fresh[name]) { delete fresh[name]; var c = chipFor(name); if (c) c.classList.remove('is-new'); } }
  search.addEventListener('input', function () { query = search.value; renderList(); });
  sortBtn.addEventListener('click', function () { sortMode = sortMode === 'az' ? 'new' : 'az'; MG.store.set('sort', sortMode); listEl.scrollTop = listEl.scrollLeft = 0; renderList(); MG.sfx.tap(); });

  /* ---------- items on the lab table ---------- */
  function addItem(name, x, y, anim) {
    var el = h('button', { class: 'al-item', type: 'button', 'aria-label': name + ', on the table' }, card(name));
    if (anim) el.firstChild.classList.add(anim);
    var it = { id: nextId++, name: name, x: x, y: y, el: el };
    place(it); lab.append(el); items.push(it); updateHint();
    return it;
  }
  function itemOf(el) { for (var i = 0; i < items.length; i++) if (items[i].el === el) return items[i]; return null; }
  function place(it) { it.el.style.left = it.x + '%'; it.el.style.top = it.y + '%'; }
  function removeItem(it) {
    items = items.filter(function (x) { return x !== it; }); it.el.remove();
    if (selected === it) selected = null;
    updateHint();
  }
  function select(it) { if (selected) selected.el.classList.remove('is-sel'); selected = it || null; if (selected) selected.el.classList.add('is-sel'); }
  function keepInside(it) {
    var lr = lab.getBoundingClientRect(), r = it.el.getBoundingClientRect();
    if (!lr.width || !lr.height) return;
    var hx = Math.min(50, r.width / 2 / lr.width * 100 + 1), hy = Math.min(50, r.height / 2 / lr.height * 100 + 1);
    it.x = Math.max(hx, Math.min(100 - hx, it.x)); it.y = Math.max(hy, Math.min(100 - hy, it.y)); place(it);
  }
  function freeSpot() {
    var lr = lab.getBoundingClientRect(), W = lr.width || 320, H = lr.height || 320;
    var mx = Math.min(45, 50 / W * 100), my = Math.min(45, 46 / H * 100);
    function rnd() { return [mx + Math.random() * (100 - 2 * mx), my + Math.random() * (100 - 2 * my)]; }
    for (var t = 0; t < 40; t++) {
      var p = rnd();
      if (items.every(function (it) { return Math.abs(it.x - p[0]) / 100 * W > 86 || Math.abs(it.y - p[1]) / 100 * H > 78; })) return p;
    }
    return rnd();
  }
  function itemAt(px, py, except) {
    var hit = null; // the last match is the one drawn on top
    items.forEach(function (it) {
      if (it === except) return;
      var r = it.el.getBoundingClientRect();
      if (px >= r.left - 8 && px <= r.right + 8 && py >= r.top - 8 && py <= r.bottom + 8) hit = it;
    });
    return hit;
  }
  function updateHint() {
    var first = found.length <= BASE.length;
    labHint.textContent = first ? 'Tap two elements to mix them, or drag one onto another.'
      : items.length ? '' : 'Your table is empty. Tap or drag elements from your list.';
    labHint.hidden = !labHint.textContent;
  }

  /* ---------- mixing ---------- */
  function mix(a, b) {
    var res = BOOK[pairKey(a.name, b.name)];
    if (!res) { fizzle(a, b); return; }
    var x = b.x, y = b.y;
    removeItem(a); removeItem(b);
    var isNew = found.indexOf(res) < 0;
    var it = addItem(res, x, y, isNew ? 'is-born' : 'is-pop');
    sparkle(it.el, isNew ? 18 : 8);
    if (isNew) {
      found.push(res); fresh[res] = 1; MG.store.set('found', found);
      say([{ e: EMOJI[res] }, ' New: ' + res + '!'], 'is-new');
      [523, 659, 784, 1047].forEach(function (f, i) { MG.tone(f, 0.14, 'triangle', 0.055, 0, i * 0.07); });
      MG.vibrate(15);
      countPill.classList.remove('is-bump'); void countPill.offsetWidth; countPill.classList.add('is-bump');
      renderList(); updateHint();
      var c = chipFor(res); if (c) reveal(c);
      if (found.length === ALL.length) setTimeout(allDone, 900);
      else if (found.length % 25 === 0) { MG.confetti(120); MG.sfx.win(); }
      MG.event('discover', { name: res, count: found.length });
    } else {
      say([{ e: EMOJI[res] }, ' ' + res], '');
      MG.tone(660, 0.1, 'triangle', 0.045); MG.tone(880, 0.1, 'sine', 0.025, 0, 0.06);
    }
    if (kbd) try { it.el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    save();
  }
  function fizzle(a, b) { // no recipe for this pair: the natures of the two decide the byproduct
    var res = FIZZ[pairKey(tagOf(a.name), tagOf(b.name))] || 'Mixture';
    var x = b.x, y = b.y;
    removeItem(a); removeItem(b);
    var it = addItem(res, x, y, 'is-pop');
    sparkle(it.el, 4);
    say([{ e: '🧪' }, ' The mix fizzles into ', { e: EMOJI[res] }, ' ' + res], 'is-soft');
    MG.tone(240, 0.15, 'sine', 0.04, 160);
    if (kbd) try { it.el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    save();
  }
  function say(parts, cls) { // parts: text, or { e: emoji, sr: true to let screen readers read the emoji }
    banner.className = 'al-banner'; banner.innerHTML = '';
    parts.forEach(function (p) { banner.append(typeof p === 'string' ? p : h('span', { class: 'al-emoji', 'aria-hidden': p.sr ? null : 'true', text: p.e })); });
    void banner.offsetWidth;
    banner.className = 'al-banner is-on' + (cls ? ' ' + cls : '');
  }
  function sparkle(el, n) {
    if (reduce) return;
    var r = el.getBoundingClientRect(), rr = root.getBoundingClientRect(), cols = ['#FFD15C', '#FF6FB5', '#5EF2C2'];
    for (var k = 0; k < n; k++) {
      var s = h('i', { class: 'al-spark', 'aria-hidden': 'true' }), a = (k / n) * 6.283 + Math.random() * 0.3, d = 44 + Math.random() * 46;
      s.style.left = (r.left - rr.left + r.width / 2) + 'px'; s.style.top = (r.top - rr.top + r.height / 2) + 'px';
      s.style.background = cols[k % 3]; s.style.color = cols[k % 3];
      s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      root.append(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 700);
    }
  }
  function hint() {
    var opts = [];
    RECIPES.forEach(function (r) {
      var m = r.split('='), ab = m[0].split('+');
      if (found.indexOf(m[1]) < 0 && found.indexOf(ab[0]) >= 0 && found.indexOf(ab[1]) >= 0) opts.push([ab[0], ab[1], m[1]]);
    });
    if (!opts.length) { say([{ e: '🏆' }, ' You have found everything!'], 'is-new'); return; }
    var p = opts[(Math.random() * opts.length) | 0], show = Math.random() < 0.5 ? p[0] : p[1];
    say([{ e: '💡' }, ' Try ', { e: EMOJI[show] }, ' ' + show + ' with something to make ', { e: EMOJI[p[2]], sr: true }], 'is-hint');
    if (query) { query = ''; search.value = ''; renderList(); }
    var c = chipFor(show);
    if (c) { c.classList.add('is-hinted'); reveal(c); setTimeout(function () { c.classList.remove('is-hinted'); }, 3200); }
    MG.tone(880, 0.08, 'sine', 0.04); MG.tone(1175, 0.1, 'sine', 0.035, 0, 0.08);
    MG.event('hint', { count: found.length });
  }

  /* ---------- dialogs ---------- */
  function dialog(emoji, title, text, buttons) {
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'al-bigemoji', 'aria-hidden': 'true', text: emoji }), h('h2', { class: 'mg-title', text: title }),
      h('p', { class: 'mg-sub', text: text }), h('div', { class: 'mg-row' }, buttons)));
    overlay.hidden = false;
    MG.focusSafe(buttons[buttons.length - 1]);
  }
  function closeOverlay() { overlay.hidden = true; overlay.innerHTML = ''; }
  function allDone() {
    MG.sfx.win(); MG.confetti(200);
    var ok = h('button', { class: 'mg-btn', type: 'button', text: 'Keep playing' });
    ok.addEventListener('click', closeOverlay);
    dialog('⚗️', 'Master alchemist!', 'You discovered all ' + ALL.length + ' elements. Every recipe in the book is yours.', [ok]);
    MG.event('win', { count: found.length });
  }
  function askReset() {
    var no = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Cancel' });
    var yes = h('button', { class: 'mg-btn', type: 'button', text: 'Start over' });
    no.addEventListener('click', closeOverlay);
    yes.addEventListener('click', function () {
      closeOverlay(); found = BASE.slice(); fresh = {}; query = ''; search.value = '';
      MG.store.set('found', found); items.slice().forEach(removeItem); select(null);
      addItem('Water', 34, 50, 'is-pop'); addItem('Fire', 66, 50, 'is-pop');
      renderList(); updateHint(); save(); MG.sfx.tap();
      say([{ e: '⚗️' }, ' A fresh start. Good luck!'], 'is-soft');
    });
    dialog('⚗️', 'Start over?', 'This forgets the ' + found.length + ' elements you have found. You keep Water, Fire, Earth and Air.', [no, yes]);
  }
  function save() {
    if (o.showcase) return;
    MG.store.set('lab', items.slice(-40).map(function (it) { return [it.name, Math.round(it.x * 10) / 10, Math.round(it.y * 10) / 10]; }));
  }

  /* ---------- pointer: drag from the list, drag on the table, tap to select and mix ---------- */
  var drag = null;
  function point(d, e) { return d.chipName ? [e.clientX, e.clientY - d.lift] : [e.clientX - d.off[0], e.clientY - d.off[1]]; }
  function mark(t) { items.forEach(function (x) { x.el.classList.toggle('is-target', x === t); }); }
  root.addEventListener('pointerdown', function (e) {
    if (!overlay.hidden || e.button > 0 || drag) return;
    var c = e.target.closest('.al-chip'), el = e.target.closest('.al-item'), it = el ? itemOf(el) : null;
    if (!c && !it) return;
    kbd = false;
    try { (c || el).setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var off = [0, 0];
    if (it) { var r = el.getBoundingClientRect(); off = [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)]; e.preventDefault(); }
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, chipName: c ? c.getAttribute('data-name') : null,
      item: it, ghost: null, off: off, lift: e.pointerType === 'touch' ? 36 : 0 };
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 8) return;
      drag.moved = true;
      if (drag.chipName) { drag.ghost = h('div', { class: 'al-item al-ghost', 'aria-hidden': 'true' }, card(drag.chipName)); root.append(drag.ghost); }
      else { drag.item.el.classList.add('is-drag'); select(null); }
    }
    var p = point(drag, e);
    if (drag.ghost) { var rr = root.getBoundingClientRect(); drag.ghost.style.left = (p[0] - rr.left) + 'px'; drag.ghost.style.top = (p[1] - rr.top) + 'px'; }
    else { var lr = lab.getBoundingClientRect(); drag.item.x = (p[0] - lr.left) / lr.width * 100; drag.item.y = (p[1] - lr.top) / lr.height * 100; place(drag.item); }
    mark(itemAt(p[0], p[1], drag.item));
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; mark(null);
    if (!d.moved) { tap(d); return; }
    var p = point(d, e), lr = lab.getBoundingClientRect();
    var inLab = p[0] >= lr.left && p[0] <= lr.right && p[1] >= lr.top && p[1] <= lr.bottom;
    if (d.ghost) {
      d.ghost.remove();
      if (!inLab) return;
      useChip(d.chipName);
      var target = itemAt(p[0], p[1], null);
      var nu = addItem(d.chipName, (p[0] - lr.left) / lr.width * 100, (p[1] - lr.top) / lr.height * 100, 'is-pop');
      MG.tone(500, 0.05, 'triangle', 0.04);
      if (target) mix(nu, target); else { keepInside(nu); save(); }
    } else {
      d.item.el.classList.remove('is-drag');
      if (!inLab) { removeItem(d.item); MG.tone(260, 0.06, 'sine', 0.03, 180); save(); return; }
      var tg = itemAt(p[0], p[1], d.item);
      if (tg) mix(d.item, tg); else { keepInside(d.item); save(); }
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; mark(null);
    if (d.ghost) d.ghost.remove();
    if (d.item && d.moved) { d.item.el.classList.remove('is-drag'); keepInside(d.item); save(); }
  });
  var lastTap = { id: 0, t: 0 };
  function tap(d) {
    if (d.chipName) { // a list element goes onto the table; if something is picked, they mix straight away
      useChip(d.chipName);
      var sp = freeSpot(), nu = addItem(d.chipName, sp[0], sp[1], 'is-pop');
      MG.tone(500, 0.05, 'triangle', 0.04);
      if (selected) { var s = selected; select(null); mix(nu, s); return; }
      select(nu); save(); return;
    }
    var it = d.item, now = performance.now();
    if (!it) return;
    if (lastTap.id === it.id && now - lastTap.t < 330) { // double tap: a copy of it
      lastTap = { id: 0, t: 0 }; select(null);
      var cp = addItem(it.name, it.x + 7, it.y + 6, 'is-pop'); keepInside(cp);
      MG.tone(560, 0.05, 'triangle', 0.04); save(); return;
    }
    lastTap = { id: it.id, t: now };
    if (!selected) { select(it); MG.tone(620, 0.04, 'sine', 0.03); return; }
    if (selected === it) { select(null); return; }
    var a = selected; select(null); mix(a, it);
  }
  lab.addEventListener('click', function (e) { if (e.target === lab || e.target === labHint) select(null); });

  /* ---------- keyboard: Enter or Space acts like a tap; Delete takes an element off the table ---------- */
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!overlay.hidden) closeOverlay(); else select(null); return; }
    var c = e.target.closest && e.target.closest('.al-chip'), el = e.target.closest && e.target.closest('.al-item');
    if (el && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); var gone = itemOf(el); if (gone) { removeItem(gone); save(); } return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!c && !el) return;
    e.preventDefault(); kbd = true;
    tap({ chipName: c ? c.getAttribute('data-name') : null, item: el ? itemOf(el) : null });
  });
  hintBtn.addEventListener('click', hint);
  clearBtn.addEventListener('click', function () { items.slice().forEach(removeItem); select(null); save(); MG.tone(300, 0.08, 'sine', 0.03, 200); });
  resetBtn.addEventListener('click', askReset);
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- start ---------- */
  renderSound();
  if (o.showcase) { // still frame: a busy lab table moments after a volcano was discovered
    root.classList.add('is-showcase');
    found = ['Water', 'Fire', 'Earth', 'Air', 'Steam', 'Lava', 'Rainbow', 'Unicorn', 'Dragon', 'Rocket', 'Pizza', 'Butterfly',
      'Flower', 'Snowman', 'Diamond', 'Cat', 'Volcano', 'Cloud', 'Planet', 'Fairy', 'Ice Cream', 'Crown', 'Tree', 'Sun'];
    fresh = { Volcano: 1 };
    renderList(); labHint.hidden = true;
    [['Cloud', 50, 27], ['Fire', 80, 38], ['Unicorn', 80, 73], ['Dragon', 50, 86], ['Rainbow', 20, 73], ['Water', 20, 38]]
      .forEach(function (p) { addItem(p[0], p[1], p[2]); });
    addItem('Volcano', 50, 56, 'is-still');
    labHint.hidden = true;
    banner.innerHTML = ''; banner.append(h('span', { class: 'al-emoji', text: '🌋' }), ' New: Volcano!');
    banner.className = 'al-banner is-new is-still';
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  } else {
    renderList();
    var start = MG.store.get('lab', null);
    (Array.isArray(start) ? start : [['Water', 34, 50], ['Fire', 66, 50]]).forEach(function (p) {
      if (p && EMOJI[p[0]] && (found.indexOf(p[0]) >= 0 || BYPRODUCT[p[0]])) addItem(p[0], +p[1] || 50, +p[2] || 50);
    });
    updateHint();
  }
  MG.ready();
})();
