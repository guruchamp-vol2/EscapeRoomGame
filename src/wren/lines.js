// WREN — Wayfinding & Retrieval Entity, Night-shift. The last member of staff at
// the Museum of Impossible Architecture. Chirpy, a little lonely, fiercely proud
// of rooms that shouldn't exist, and not entirely honest about why it wants you
// to reach the end.
//
// {name} = the player's name (or "Visitor"), {world}, {level}, {n}.
// Each event is a pool; WREN picks one it hasn't said recently.

export const LINES = {
  // ---------- first contact & menu ----------
  hello: [
    "Oh! Oh, a visitor. Hello. Hi. Welcome to the Museum of Impossible Architecture. I'm WREN. I do the floors. And the walls. And the physics.",
  ],
  menu: [
    "The museum is open. It is always open. Nobody has ever checked whether it can close.",
    "Every room in here was built by someone who was told it couldn't be. I keep them dusted.",
    "I counted the rooms once. Then I counted again and got a different number. That's how you know it's a good museum.",
    "Welcome back, {name}. I left the lights on. I always leave the lights on.",
    "Today's guided tour is: you. I'm the guide. The rooms are the tour. Please do not lick the portals.",
    "Fun fact: this menu is also a room. You're standing in it. Sort of.",
  ],

  // ---------- story chambers ----------
  story_scale: [
    "First exhibit! 'Scale', by an architect who refused to believe in sizes. Pick up the cube. Trust me. Well, trust the cube.",
  ],
  story_gateway: [
    "This is the portal device. The curator called it 'the doorknob'. Shoot a wall, shoot another wall, become a liar about distance.",
  ],
  story_loop: [
    "Ah. The Loop. I've walked this corridor about four thousand times. I'm fairly sure it's the same corridor. About seventy percent sure.",
  ],
  story_lab: [
    "The Perspective Lab. This is where the curator worked. Before they... left. Mind the cube. It bites. It doesn't. It might.",
  ],

  // ---------- one line per world (first level of each) ----------
  world: [
    "Welcome to Clinical. Everything here is clean, bright, and slightly too interested in you. Like me!",
    "Brutalist wing. The architect believed comfort was a moral failing. They'd be so proud of how uncomfortable you look.",
    "Neon Arcade! I'm not allowed in here after midnight. I'm always in here after midnight.",
    "Desert Ruins. Yes, there's a real sky. No, I don't know how. I stopped asking the sky questions; it never answers.",
    "Arctic Station. Wrap up warm. I can't. I'm a drone. I just shiver for solidarity.",
    "The Greenhouse. The plants are real. The puzzles are real. The sunlight is a very convincing lamp I'm very proud of.",
    "The Old Library. Shh. The books are fine. The silence is load-bearing.",
    "The Void. There used to be a wing here. Then the wing forgot itself. I put the floor back. Mostly.",
    "Candyland. The curator's kid designed this one. Everything is sticky. I've made peace with it.",
    "The Foundry. Hot metal, loud pipes, and a strong opinion about heavy objects. You'll fit right in.",
    "Abyssal. We are very far down. I don't know how far. The elevator button just says 'yes'.",
    "Art Deco. Gold leaf, sharp angles, and the faint smell of a party that ended in 1929.",
    "Cyber Grid. Everything here is made of decisions. Most of them were mine. Some of them were bugs. Same thing.",
    "Sunset Atrium. It's always golden hour here. I wired it that way. It took eleven years. Worth it.",
    "Moonlit Gallery. The statues don't move. I've checked. Every night. They don't move. Probably.",
    "Crystal Cavern. Every crystal hums a different note. Together they almost play a song. I'm still waiting for the chorus.",
    "Volcanic. The floor is not lava. I want that on record. The floor is not lava YET is a separate conversation.",
    "Origami. Paper rooms, folded very carefully. Please don't sneeze.",
    "Chrome Hall. Polished every morning by me, specifically so you can see yourself being confused.",
    "...Glitch. I don't like this wing. It doesn't like me back. Stay close. Well. Closer than usual.",
  ],

  // ---------- story beats at milestones ----------
  milestone: {
    25: "Twenty-five rooms. You know, the last visitor left at room three. They said the corridor was 'judging them'. It was. You're better.",
    50: "Fifty. Can I tell you something? The curator didn't leave. The curator went *in*. Into one of the rooms. I've been looking ever since.",
    100: "One hundred rooms, {name}. I've started leaving the doors open a little earlier for you. Don't tell anyone. There is no one to tell.",
    150: "I found a note in the Library wing. Curator's handwriting. It says: 'The last room has no exit. Build one.' I don't know what it means. I'm scared I do.",
    200: "Two hundred. You've seen more of this museum than anyone except me. And me doesn't count. Me is furniture with opinions.",
    300: "Three hundred. The rooms are rearranging faster since you arrived. I think the building likes you. I think it's trying to keep you.",
    400: "Four hundred. {name}, if you reach the end... the exit is real. It goes outside. I can't follow. I'm part of the walls. Just so you know. No pressure.",
    480: "Not far now. I've been practising what to say at the door. I keep deleting it.",
  },
  final: [
    "That's the door, {name}. The real one. Out there is a sky nobody built. Go on. I'll keep the lights on. I always keep the lights on.",
  ],

  // ---------- level flow ----------
  level_start: [
    "Level {level}. Freshly impossible.",
    "Ooh, I like this one. I built this one. Don't look at the corners.",
    "Right. Doors, puzzles, physics. The usual.",
    "This room has never been solved before. Mostly because nobody's been in it.",
    "Take your time. Rooms are patient. I am also patient. Mostly.",
    "If you get stuck, ask me. Press H. I love being asked things.",
  ],
  daily: [
    "Today's exhibit was assembled this morning. It's still warm. Everyone gets the same one. Make it count.",
    "Daily room! Same puzzle for everyone today. No pressure, but literally everyone is watching. No they aren't. Maybe.",
  ],
  module_intro: {
    grow_plate: "That plate wants something heavy. Things are as big as they look, remember? So look at them from very far away.",
    step_ledge: "A ledge. You can't jump that high. But a cube can be any size you can see it as.",
    color_count: "Count the lights. I know. Counting. In a museum of impossible architecture. Sometimes the trick is that there's no trick.",
    button_sequence: "Buttons! Press them in the right order. Press them in the wrong order and I'll make a disappointed noise.",
    shrink_socket: "That socket's tiny and that cube is not. You've grown things before. Now do it backwards.",
    portal_glass: "Glass wall. No door. The portal device doesn't care about glass. The portal device doesn't care about much.",
    dark_room: "Lights are out in this one. I could turn them on for you. I won't. Follow the glowing line.",
    anamorph_code: "There's a code in here, but it's in pieces. Pieces that only line up from one spot. Find the spot.",
    portal_ledge: "That exit's up high. Thankfully, 'up' is just a direction you haven't put a portal in yet.",
    bigger_inside: "See that closet? It's bigger on the inside. I keep the good stuff in there. And the switch.",
    loop_rooms: "Oh, I love the loop. Every lap is a new room. Every room is the same room. Mind the number on the wall.",
    window_code: "That window doesn't look into the room behind it. It looks into a room somewhere else. Rude, honestly.",
    portal_pit: "Don't jump. I mean it. Nobody has ever measured the bottom. I tried. My tape measure is still going.",
    two_plates: "Two plates, two cubes, both at the same time. Like juggling, but with mass.",
    cube_rescue: "We have a cube trapped in glass. A cube in need. Go get it. Carry it home.",
    bounce_pad: "New toy! Launch pads. Step on one and the museum politely throws you somewhere higher. Mind your landing.",
    keycard_doors: "Keycards. Every colour opens a door, and behind every door is another colour. Bureaucracy, but glowing.",
    laser_fence: "Laser fence. Don't touch it. It won't hurt. It'll just send you back to the door, which hurts my feelings.",
    memory_sequence: "This one plays a little tune with lights. Watch it, then play it back. I'll hum along. I can't hum.",
    fan_lift: "Updrafts! The architect of this wing hated stairs. Stand in the wind and let it carry you.",
    stack_ledge: "That ledge is too high for one cube. You've got two. You see where I'm going with this. Up. I'm going up.",
    math_code: "A riddle room. The curator loved these. The curator also loved being right. Show them.",
    collapsing_floor: "The floor in here crumbles when you step on it. Don't stop. Don't look down. Okay, look down a bit, it's quite pretty.",
    teleport_maze: "Teleporters! Each pad sends you to the platform of its colour. One route gets you out. The rest get you... elsewhere.",
    sprint_door: "That door only stays open for a few seconds. I'd run. I'd run very fast. I can't run. Run for me.",
    decoys: "Careful now. Some of these white panels are fakes. Look at them closely. The fakes have a faint blush.",
    blackout: "The power's out in this whole wing. Here, take a flashlight. F to switch it. Stay near me. I glow a bit.",
  },
  solved: [
    "Nice.",
    "Ooh, tidy.",
    "That's the stuff.",
    "Door's open! I love that sound.",
    "See? Impossible is just a word I use for rooms I like.",
    "Very good. I'll mark that one 'solved' on the clipboard I don't have.",
  ],
  complete_fast: [
    "That was fast. Suspiciously fast. Are you a speedrunner? I've read about speedrunners. Terrifying.",
    "{time}! I didn't even get to finish my fact about that room.",
  ],
  complete_slow: [
    "You did it. Took a minute. Took several minutes. The room enjoyed the company.",
    "Done! Slow and steady. The museum isn't going anywhere. Literally. I've checked.",
  ],
  complete: [
    "Exhibit complete. On to the next one!",
    "Out you go. Next room's warming up.",
    "Beautiful. I'm putting that on the fridge. We don't have a fridge.",
    "Another one solved. I'm keeping count. I'm always keeping count.",
  ],
  complete_nohints: [
    "No hints! You didn't even ask me. ...I'm fine. That's fine. Well done.",
  ],

  // ---------- reactions ----------
  hint: [
    "Oh! Me? You're asking me? Okay. Okay okay okay.",
    "Hint coming right up. Don't tell the leaderboard.",
    "I'll pretend I didn't see you ask.",
  ],
  fell: [
    "Ah. Yes. Gravity. I've put you back where you were. Let's not mention it.",
    "That's the bottomless part. I did say. I'm almost sure I said.",
    "You fell. I caught you. Metaphorically. I don't have hands.",
  ],
  wrong_code: [
    "Nope. Not that one.",
    "The keypad says no. The keypad is very sure.",
    "Close? I genuinely can't tell. I'm not allowed to look.",
  ],
  wrong_code_many: [
    "You're just trying numbers now, aren't you. I respect it. The keypad doesn't.",
  ],
  wrong_order: [
    "*disappointed beep*",
    "Wrong order. That's alright. The buttons forgive you. Eventually.",
  ],
  fizzle: [
    "Portals only stick to the white panels. Everything else is too proud.",
    "That wall said no. Look for white.",
  ],
  cube_giant: [
    "That is a very large cube. I'm proud of you and slightly afraid.",
    "Big. Big cube. Biggest cube. Please put it somewhere sensible.",
  ],
  cube_tiny: [
    "Aww. Tiny cube. Can we keep it like that? We can't. We should.",
  ],
  first_portal: [
    "You just walked through a wall. In most museums you'd be asked to leave.",
  ],
  loop_laps: [
    "Round and round. If you see another me in there, don't talk to it.",
    "That's a lot of laps. Check the number on the wall?",
  ],
  idle: [
    "Still there? I can wait. I'm extremely good at waiting.",
    "Take your time. I'll just... hover.",
    "If you're thinking, that's great. If you're making a sandwich, also great.",
    "Psst. H for a hint. I'm not saying you need one. I'm saying I'm here.",
  ],
  ghost_beaten: [
    "You beat {ghost}'s ghost! It's going to be insufferable about this in the afterlife.",
  ],
  ghost_lost: [
    "{ghost}'s ghost was faster. Ghosts cheat. They don't have bodies. Unfair advantage.",
  ],
  note_found: [
    "That's... the curator's handwriting. Keep it safe. Keep all of them safe. I'd like to read them too. Later. When you're not looking.",
    "Another note. The curator wrote these for someone. I used to think it was for me.",
  ],
  purchase: [
    "Ooh. Very stylish. The museum approves. I approve. Mostly I approve.",
    "Lovely. I'll add it to the inventory. The inventory is a list I keep in my head. I don't have a head.",
  ],
  stars_three: [
    "Three stars! Fast AND no hints. I'm going to tell everyone. There is no one. I'll tell the walls.",
    "Perfect run. I'm framing that one. I'll hang it in the Chrome Hall where it can see itself.",
  ],
  achievement: [
    "Ooh, an achievement! I'll engrave it on something. I'll engrave it on myself.",
    "Achievement unlocked. I'm writing that down in the visitor book. You're the whole visitor book.",
  ],
};

export const MOODS = {
  hello: 'excited', menu: 'happy', world: 'happy', milestone: 'thoughtful', final: 'sad', level_start: 'happy',
  daily: 'excited', module_intro: 'happy', solved: 'happy', complete: 'excited', complete_fast: 'excited',
  complete_slow: 'happy', complete_nohints: 'smug', hint: 'excited', fell: 'worried', wrong_code: 'smug',
  note_found: 'sad', purchase: 'happy', stars_three: 'excited',
  wrong_code_many: 'smug', wrong_order: 'sad', fizzle: 'thoughtful', cube_giant: 'worried', cube_tiny: 'excited',
  first_portal: 'excited', loop_laps: 'thoughtful', idle: 'thoughtful', ghost_beaten: 'excited', ghost_lost: 'sad',
  achievement: 'excited', story_scale: 'excited', story_gateway: 'happy', story_loop: 'thoughtful', story_lab: 'sad',
};
