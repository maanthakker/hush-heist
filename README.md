# Hush Heist

It's 2 AM. You lead the Hush Squad through a giant sleeping house to grab the legendary Midnight Snack Stash, and nobody can wake up.

This repo is a MERN stack game: **React + three.js** frontend, **Node.js + Express + Socket.io** backend, **MongoDB** database. It is built in six phases; this release contains **all six phases**.

---

## What's in this release

**Phase 1: core sneaking.** Noise meter (tiptoe silent, walk quiet, run loud), creaky floorboards, squeaky toys, creaky doors, wake meters on every sleeper, a sleepy cat and robot patrollers with vision cones, hiding spots, and THE SHH (`E`): a silence wave that calms anyone about to wake up and cancels nearby noise for 3 seconds, on a 10 second cooldown.

**Phase 2: your hero, emotes and accounts.** The hero now has knees, blinks, tiptoes on his toes and leans into a run, still with thick black hair, short sides, a choppy fringe, the striped brown shirt and the one-eyebrow-up look. Five emotes on keys `1`–`5`: the Shh (also the victory pose), wave, a snack dance (noisy!), shrug and thumbs up. Accounts are a username and password only (salted scrypt hashes, no email, no real names); coins, unlocks, outfits and best runs are saved in MongoDB. Guests can still play and keep progress on their device.

**Phase 3: multiplayer.** Parties of up to 4 with a 6-letter room code, a party lobby where the host picks the mode and level, and real-time sync over Socket.io. The server runs the game rules; each player's device moves its own hero instantly and smooths everyone else. Safety: parties are friends-only (only players on the host's friends list can join), there are no public lobbies, and there is no free typing anywhere: just 8 preset quick-chat lines and emotes.

**Phase 4: game modes and levels.**
- Co-op Heist: grab the snacks together, and the whole squad has to make it back.
- Hide & Seek: one player is the Night Guard with a flashlight; the others get 12 seconds to hide. Spotted in the flashlight, tagged, or found when the guard searches your hiding spot with `F`, and you're out. Hiders win if anyone is still hidden when the 90 second timer ends.
- Fridge Race: first to the fridge wins. Wake someone up or get spotted, and you're sent back to the start.
- Levels: The Jungle Room, The Kitchen (the Midnight Snack Stash is in the fridge), The Garage (a robot mower and a car to hide under), and The Attic boss level, where Grandpa sleeps with one eye open: when it opens it sweeps the room, and if it catches you his wake meter jumps. Solo levels unlock one at a time.

**Phase 6: polish.**
- Sound and music, all made in code with the Web Audio API (no audio files): footsteps, creaks, squeaks, doors, the cat, robot beeps, Grandpa's "huh?!", the Shh's hushing whoosh, snack chimes, hide and seek sounds, countdown ticks, win and lose jingles, coins and button clicks. Sounds are louder near you and pan left and right.
- A soft night-time lullaby that changes with the danger: as someone stirs or a cone locks onto you, it speeds up and a heartbeat comes in.
- Full touch controls: put your thumb down anywhere on your side of the screen and the stick appears under it (gentle push tiptoes, full push walks), big Run and Hide/Search buttons, an emote drawer, vibration on alarms, and a left-handed layout.
- Menus: a Settings tab and settings in the pause menu (music and sound volume, mute, graphics quality with a battery saver, reduce motion, full screen, vibration, left-handed), a How to play tab, and smooth screen transitions.

**Wake-ups turn into chases.** When someone's wake meter fills, they don't just end the round: they get up (still wrapped in their blanket) and chase you. They're faster than tiptoeing but slower than running. If they catch you, you're out (in a co-op heist the others can still finish). Dive into a hiding spot and they lose you, search for a few seconds, then shuffle back to bed. The Shh stops a chaser in their tracks for a moment. **If the Baby wakes up, she cries in her crib and everyone else wakes up and chases you.** Use the Shh near her to calm her down. In Fridge Race, getting caught sends you back to the start; in Hide & Seek, a caught hider is out.

**Make your own levels, and Online levels.** Menu → **Online levels** → **Make a new level** opens the editor: a top-down grid where you draw walls and place furniture (closets, boxes, trunks, tables and cars become hiding spots), snacks, the golden stash, sleepers (Dad, Mom, Big Sis, Little Bro, Baby, Grandpa, Uncle), patrollers with routes (cat, robot vacuum, robot mower), creaky boards, squeaky toys, the start and the exit mat. Pick a theme, a size and how many snacks are needed. You can **test your level any time** with the ▶ Test button (or Ctrl+Enter), even half-built; Esc → Back to editor brings you straight back. The editor also checks the level is playable as you build (everything reachable, no patrol route through a wall), and **you must beat your own level in Test play before you can publish it**. Published levels show up in Online levels for everyone, sorted by New, Top (likes) or Friends, with plays and likes. Safety: level names are built from word pickers (no typing), and any level reported by 3 players is hidden automatically. Beating someone else's online level earns 10 coins (your own levels give none). Drafts are saved on your device; up to 20 published levels per player.

**Extras: first-person view and voice chat.**
- First person (POV): play through your hero's eyes. Switch in Settings, with the POV/Top button in a round, or press `V`. Move the mouse to look (click the game first), or use the ← → keys; `W`/`S` walk forward and back, `A`/`D` side-step. On phones, drag on the right side of the screen to look around. Tiptoeing lowers your view, and when you hide you peek out from your hiding spot.
- Voice chat in parties: turn it on in the lobby. Audio goes straight between players' devices over WebRTC; the server only passes along the connection messages and never records anything. Safety: you're only connected to players who are friends with you (a friend of the host who isn't your friend can't hear you), it's off until you switch it on, push-to-talk is the default (hold `T` or the talk button), open mic is optional, and you can mute anyone. Talking shows a mic next to your name.
- Mic button (top right, in the lobby and during a round, or press `M`): the first tap starts voice chat with your mic on; after that it mutes and unmutes you. Red with a slash = muted (you can still hold `T` to talk), mint = live.

**Phase 5: coins, the locker and friends.** Earn coins for snacks, stars and wins. Spend them on 6 outfits (classic stripes, starry pajamas, mint hoodie, snack chef, midnight ninja, dino onesie) and 8 hair colors. Add friends by exact username (they must accept), see who's online, and compare best stars and times per level and coin totals on the friends leaderboard.

### Controls

| Key | Action |
| --- | --- |
| `W A S D` or arrow keys | Move |
| Hold `Space` (or `C`) | Tiptoe: silent |
| Hold `Shift` | Run: loud |
| `E` | THE SHH |
| `F` | Hide, or slip back out (Night Guard: search a hiding spot) |
| `1` `2` `3` `4` `5` | Emotes: Shh, wave, dance, shrug, thumbs up |
| `V` | Switch between top-down and first person |
| Mouse / `←` `→` | Look around (first person) |
| Hold `T` | Push to talk (party voice chat) |
| `M` or the top-right mic button | Mute / unmute your mic |
| `Esc` or `P` | Pause |

On phones and tablets: put your thumb down anywhere on the left half of the screen and a stick appears under it. Push it gently to tiptoe, all the way to walk, and hold **Run** to run. Tap **Shh** for the Shh, and **Hide** / **Search** when it pops up. Emotes and quick chat open from buttons. Left-handed? Flip the layout in Settings.

---

## Run it on your computer

You need **Node.js 20** (18.18 or newer works) and Git.

```bash
# 1. Install everything (client and server)
npm run setup

# 2. Create your env files from the examples
cp client/.env.example client/.env
cp server/.env.example server/.env
#    Paste your MongoDB connection string into server/.env (see step 1 below).
#    Leaving it empty is fine: the game works, runs just aren't saved.

# 3. Start the backend (terminal 1)
npm run dev:server     # http://localhost:4000/api/health

# 4. Start the game (terminal 2)
npm run dev:client     # open http://localhost:5173
```

Run the tests any time with `npm test`. They check every level's layout (reachable snacks, exits, hiding spots, patrol routes), the noise and wake rules, the Shh, hiding, all three modes, Grandpa's eye, network snapshots, and party rooms (codes, friends-only joining, host hand-over, coins).

To try multiplayer locally: make two accounts (use a private window for the second), add each other as friends, start a party in one and join with the code in the other.

---

## Easiest: everything on one Render service

The server can also serve the game itself, so one Render web service runs the whole thing (game + API + multiplayer) at one address, with no CORS settings.

1. Push this folder to GitHub (for example `hush-heist`).
2. Render → **New** → **Web Service** → pick the repo.
3. **Build Command** `npm run render-build`, **Start Command** `npm start`, **Health Check Path** `/api/health`.
4. Environment: `MONGODB_URI` (your Atlas string), `MONGODB_DB` = `hush-heist`, `JWT_SECRET` (any long random string), `NODE_VERSION` = `20`.
5. Deploy, then open `https://<your-service>.onrender.com` and play.

(Or use **New → Blueprint**: `render.yaml` sets all of that up.) The split setup below (Netlify + Render/Railway) still works too.

## Deploy it (step by step)

You'll end up with three pieces: a **MongoDB Atlas** database, the **backend** on Render or Railway, and the **frontend** on Netlify. Do them in this order.

### Step 1: Create the database (MongoDB Atlas, free)

1. Go to <https://www.mongodb.com/cloud/atlas> and sign up.
2. Create a free **M0** cluster (any region near you).
3. **Database Access** → Add New Database User → pick a username and password. Save them.
4. **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`). Render and Railway don't have fixed IP addresses, so this is needed.
5. **Database** → Connect → Drivers → copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Replace `PASSWORD` with your real password. This is your `MONGODB_URI`.

### Step 2: Push the code to GitHub

```bash
cd hush-heist
git init
git add .
git commit -m "Hush Heist: all six phases"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/hush-heist.git
git push -u origin main
```

`.env` files are in `.gitignore`, so your passwords stay off GitHub.

### Step 3: Deploy the backend (pick Render **or** Railway)

#### Option A: Render

**Fastest way (Blueprint):**
1. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
2. Connect your GitHub and pick the `hush-heist` repo. Render reads `render.yaml`.
3. When it asks for environment variables, fill in:
   - `MONGODB_URI`: your Atlas string from Step 1
   - `CLIENT_ORIGIN`: put `http://localhost:5173` for now (you'll add the Netlify URL in Step 5)
   - `JWT_SECRET` is generated for you by the Blueprint.
4. Click **Apply**. When the deploy is green, open `https://YOUR-SERVICE.onrender.com/api/health`. You should see `"ok": true` and `"db": "connected"`.

**Manual way:** New → **Web Service** → pick the repo, then set **Root Directory** `server`, **Build Command** `npm install`, **Start Command** `npm start`, **Health Check Path** `/api/health`, and add the same environment variables plus `JWT_SECRET` (any long random string).

> Render's free plan falls asleep after about 15 minutes with no visitors. The first visit after that takes up to a minute to wake it, and the title screen will say "Hush HQ is asleep" until it does. The game itself is playable the whole time.

#### Option B: Railway

1. Go to <https://railway.com> → **New Project** → **Deploy from GitHub repo** → pick `hush-heist`.
2. Open the new service → **Settings** → set **Root Directory** to `/server`.
3. **Variables** → add `MONGODB_URI`, `MONGODB_DB` = `hush-heist`, `CLIENT_ORIGIN` = `http://localhost:5173` for now, and `JWT_SECRET` = any long random string (it signs login tokens; keep it secret). Railway sets `PORT` for you.
4. **Settings** → **Networking** → **Generate Domain**.
5. Open `https://YOUR-APP.up.railway.app/api/health` to check it.

Copy your backend URL (no slash at the end). You need it next.

### Step 4: Deploy the frontend (Netlify)

1. Go to <https://app.netlify.com> → **Add new site** → **Import an existing project** → GitHub → pick `hush-heist`.
2. Netlify reads `netlify.toml`, so base directory (`client`), build command (`npm run build`) and publish folder (`dist`) fill in by themselves.
3. Before deploying, open **Environment variables** and add
   `VITE_API_URL` = your backend URL from Step 3, e.g. `https://hush-heist-server.onrender.com`
4. Click **Deploy**. You'll get a URL like `https://hush-heist-xyz.netlify.app`.

> Vite bakes `VITE_API_URL` in at build time. If you change it later, go to **Deploys** → **Trigger deploy** → **Deploy site** so the change takes effect.

### Step 5: Connect the two

Go back to Render or Railway and change `CLIENT_ORIGIN` to include your Netlify URL:

```
CLIENT_ORIGIN=https://hush-heist-xyz.netlify.app,http://localhost:5173
```

Save; the backend redeploys. Open your Netlify site: the title screen should say **Hush HQ is online**. Finish a round and the escaped/caught totals go up.

### If something's off

| What you see | Fix |
| --- | --- |
| "Playing offline" on the title screen | `VITE_API_URL` isn't set on Netlify. Add it, then trigger a new deploy. |
| "Hush HQ is asleep" | Backend is waking up (Render free plan) or the URL is wrong. Open `/api/health` in a tab. |
| "database isn't connected yet" | Check `MONGODB_URI` (password filled in?) and Atlas Network Access (`0.0.0.0/0`). |
| Browser console says CORS | `CLIENT_ORIGIN` must exactly match your Netlify URL: `https`, no trailing slash. |
| Everyone gets logged out after a redeploy | Set `JWT_SECRET` on the backend so login tokens survive restarts. |
| "Only the host's friends can join" | The host has to accept your friend request first (Friends tab). |
| Party play feels laggy right after opening | The free backend is waking up; give it a minute. |
| Voice chat: can't hear a friend | You both have to be friends with each other (not just with the host), and both have voice turned on. Some school or office networks block direct connections; try another network. |
| Voice chat: "Microphone permission was blocked" | Allow the microphone for your site in the browser's address-bar settings. Voice needs the https site (Netlify), not a plain http address. |
| Black screen with a WebGL message | Turn on hardware acceleration in the browser settings. |

---

## Make it yours

- **Your name:** set `HERO_NAME` in `client/src/config.js`. Players can also type a name on the title screen; it's remembered on that device.
- **Difficulty:** every number lives in `server/shared/sim/tuning.js`: walk/run speeds, how far each noise carries, how fast people wake up, the Shh cooldown and radius, how quickly the cat and vacuum spot you.
- **Levels:** each file in `server/shared/levels/` lists every wall, piece of furniture, creaky board, toy, snack, hiding spot, sleeper and patrol route. Run `npm test` after editing; it catches snacks you can't reach or patrol routes that drive through walls.
- **Your look:** skin and sock colors are at the top of `client/src/game/render/hero.js`. Outfits, hair colors, prices, emotes, quick-chat lines and coin rewards are all in `server/shared/catalog.js`.

Everything is original. All textures are painted in code at runtime, so the repo ships no image files and no copyrighted characters or assets. Keep any real reference photos out of the repo; `reference-photos/` is already in `.gitignore`.

---

## How the code is organised

```
hush-heist/
├── client/                      React + Vite + three.js (deploys to Netlify)
│   └── src/
│       ├── App.jsx              Screens: title, menu, lobby, playing, paused, ended
│       ├── components/          Title, Menu (Play/Party/Locker/Friends), Lobby, Hud, TouchControls, End, Pause
│       ├── api.js  net.js       Accounts/shop/friends REST calls; the party socket
│       ├── profile.js           Guest progress kept on the device
│       └── game/
│           ├── Game.js          Renderer, camera, loop, labels, party prediction
│           ├── input.js         Keyboard, touch stick, emote keys
│   ├── src/audio/               AudioEngine: every sound effect and the music, made in code
│   ├── src/voice.js             Party voice chat (WebRTC, friends-only)
│   ├── src/settings.js          Volume, graphics, motion, vibration, left-handed (saved on the device)
│           └── render/          three.js scene: rooms, furniture, hero, family, cat, robots
├── server/                      Node + Express + Socket.io + Mongoose (Render/Railway)
│   ├── shared/                  Game rules used by BOTH client and server
│   │   ├── sim/                 Simulation (modes, noise, wake, patrols, Grandpa's eye), tuning
│   │   ├── levels/              Jungle Room, Kitchen, Garage, Attic
│   │   ├── catalog.js           Modes, emotes, quick chat, outfits, hair colors, coin rewards
│   │   └── custom.js            Player-made levels: pieces, builder, playability check
│   ├── scripts/                 sim-test.mjs and rooms-test.mjs (npm test)
│   └── src/
│       ├── index.js             App, CORS, Socket.io auth
│       ├── auth.js              Password hashing, login tokens, username rules
│       ├── game/rooms.js        Party rooms: codes, friends-only joining, server game loop
│       ├── models/              User, Run
│       └── routes/              auth, runs, shop, friends + leaderboard, health
├── netlify.toml  render.yaml  server/railway.json
```

The rules live in `server/shared/` so the server can run the exact same game the browser does. The client imports them through the `@shared` alias in `client/vite.config.js`.

### API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, phase, db, uptime }` |
| POST | `/api/runs` | Saves `{ level, result, snacks, totalSnacks, timeMs, stars, peakWake }` and returns level totals. 20 per minute per IP. |
| GET | `/api/stats?level=jungle-room` | `{ escaped, caught, fastestMs }` |
| POST | `/api/auth/register`, `/api/auth/login` | `{ username, password }` → `{ token, user }` |
| GET | `/api/me` | Your coins, unlocks, outfit, best runs |
| POST | `/api/shop/buy`, `/api/shop/equip` | Buy or wear an outfit / hair color |
| GET/POST/DELETE | `/api/friends…` | List, request, accept/decline, remove |
| GET | `/api/leaderboard?level=…` | You + friends: best heist and coins |
| GET/POST/DELETE | `/api/levels…` | Online levels: browse (`?sort=new|top|friends`), get, publish/update, delete, play, like, report |

Socket events: `room:create`, `room:join`, `room:config`, `room:start`, `room:leave`, `input`, `quick` (client → server) and `room:update`, `game:start`, `game:snap`, `game:events`, `game:end`, `quick` (server → client).

---

## Test checklist

- [ ] Title screen shows the house slowly turning behind the menu
- [ ] Start the heist: camera swoops down to your hero in the bedroom
- [ ] Walk out the door: the door creaks and the board outside creaks (rings + words)
- [ ] Hold Space and cross the same board: much smaller ring
- [ ] Run past Dad's sofa: his wake bar climbs and turns yellow, then red
- [ ] Press E: Shh pose, mint wave, wake bars drop, Shh button counts down from 10
- [ ] Right after the Shh, run around: for 3 seconds your noise shows as small mint puffs instead of rings
- [ ] Stand in the cat's or vacuum's cone: a "?" fills up; at full it meows or beeps
- [ ] Press F at a curtain, table or closet: you vanish, eyes peek out, cones ignore you
- [ ] Step on a toy: SQUEAK!
- [ ] Grab 4 snacks: the bed glows and a ring floats over it
- [ ] Get into bed: camera zooms in, hero does the Shh victory pose, stars screen
- [ ] Let someone wake up: camera turns to them, they sit up, lose screen gives a tip
- [ ] Esc pauses and resumes; switching tabs pauses automatically
- [ ] On a phone: the stick moves you (gentle push = Silent, full push = Quiet), Run and Shh buttons work
- [ ] With the backend running, the title screen says Hush HQ is online and the totals go up after a round
- [ ] Emote keys 1–5 play wave, dance, shrug, thumbs up and the Shh; moving cancels them
- [ ] Create an account, finish a heist: coins go up and stay after logging out and back in
- [ ] Locker: buy a hair color and an outfit; your hero wears them next round
- [ ] Clear the Jungle Room to unlock the Kitchen; the fridge stash is required there
- [ ] Attic: Grandpa's eye opens with a warm cone; standing in it makes him jump awake
- [ ] Two accounts: friend request + accept, party code, both in the lobby, quick chat bubbles show over heads
- [ ] A player who isn't the host's friend can't join with the code
- [ ] Co-op Heist with 2: the round only ends when both are back
- [ ] Fridge Race: waking someone sends you back to the start
- [ ] Hide & Seek: the guard is frozen for 12 s, the flashlight finds hiders, `F` searches a hiding spot
- [ ] Friends tab: online dots, leaderboard per level and by coins
- [ ] Sound starts after your first tap or key press; music speeds up and a heartbeat comes in as Dad stirs
- [ ] Creaks, squeaks and the cat sound louder when they're close, and come from the left or right
- [ ] Settings: music and sound sliders, mute, battery saver (no shadows), reduce motion, full screen; they stick after a reload
- [ ] Phone: the stick appears wherever your thumb lands, Hide pops up near hiding spots, vibration on alarms, left-handed layout swaps sides
- [ ] How to play tab explains the rules and modes
- [ ] `V` switches to first person: you see through the hero's eyes, mouse or ← → turns, `W` walks where you look
- [ ] First person on a phone: drag on the right side to look around
- [ ] Wake Dad on purpose: he gets up and chases; hide in a closet and he searches, then goes back to bed
- [ ] Wake the Baby: she cries and everyone else chases you; the Shh near her calms her
- [ ] Online levels → Make a new level: draw walls, place snacks, a sleeper, furniture and a patroller route; the checklist turns into "Looks playable!"
- [ ] Test play your level and beat it: Publish online unlocks; publish it and see it under New
- [ ] Another account can play, like and report it; 3 reports hide it
- [ ] Voice: two friends turn on voice in the lobby, hold `T` to talk and hear each other; Mute works; someone who isn't your friend shows "Not friends: no voice"

---

## Roadmap

1. **Core sneaking** ✅
2. **Hero model, animations, emotes, accounts** ✅
3. **Multiplayer: room codes, party lobby, sync** ✅
4. **3 game modes and the Kitchen, Garage and Attic** ✅
5. **Coins, outfits, hair colors, friends leaderboard** ✅
6. **Polish: sound, music, touch controls, menus** ✅
