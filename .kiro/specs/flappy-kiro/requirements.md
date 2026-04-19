# Requirements Document

## Introduction

Flappy Kiro is a retro-styled, browser-based endless scroller game inspired by Flappy Bird. The player controls a ghost character (Ghosty) through a series of vertically-scrolling pipe obstacles. The game runs entirely in the browser using HTML, CSS, and JavaScript with no backend required. The aesthetic is retro/pixel-art, using provided sprite and audio assets.

## Glossary

- **Game**: The Flappy Kiro browser application as a whole.
- **Ghosty**: The ghost character sprite controlled by the player.
- **Pipe**: A vertical obstacle pair (top and bottom) with a gap that Ghosty must pass through.
- **Pipe Width**: The horizontal thickness of each pipe wall.
- **Pair Spacing**: The fixed horizontal distance between the leading edge of one Pipe pair and the next.
- **Gap**: The vertical opening between the top and bottom pipe through which Ghosty must fly.
- **Gap Size**: The fixed vertical height of the Gap.
- **Gap Position**: The randomised vertical centre point of the Gap for a given Pipe pair.
- **Pipe Speed**: The current horizontal scroll speed of all Pipes, in pixels per frame.
- **Speed Increment**: The amount by which Pipe Speed increases as the player's Score rises.
- **Score**: The count of pipe pairs successfully passed by Ghosty.
- **High Score**: The highest Score achieved in the current browser session.
- **Game Loop**: The continuous update-and-render cycle that drives gameplay.
- **Gravity**: The constant downward acceleration applied to Ghosty during gameplay.
- **Flap**: A single upward impulse applied to Ghosty in response to player input.
- **Gravity Constant**: The fixed downward acceleration applied to Ghosty's vertical velocity each frame.
- **Ascent Velocity**: The fixed upward velocity assigned to Ghosty when a Flap is triggered.
- **Terminal Velocity**: The maximum downward speed Ghosty's vertical velocity is clamped to.
- **Momentum**: The carry-over of velocity between frames, giving Ghosty smooth arcing movement.
- **Interpolation**: Blending between physics states across frames to produce visually smooth motion.
- **Collision**: Contact between Ghosty's hitbox and a Pipe boundary or the ground/ceiling.
- **Hitbox**: The reduced axis-aligned bounding rectangle used for collision testing, inset from the visible sprite edges to allow forgiving near-misses.
- **Pipe Boundary**: The axis-aligned rectangle representing the solid area of a top or bottom pipe wall.
- **Ground Boundary**: The bottom edge of the Canvas, treated as a solid floor.
- **Ceiling Boundary**: The top edge of the Canvas, treated as a solid ceiling.
- **Collision Response**: The visual and state reaction triggered immediately when a Collision is detected.
- **Invincibility Frames**: A short window after a Collision during which further Collisions are ignored, preventing instant double-triggers.
- **Start Screen**: The initial screen shown before the first game begins, displaying the title and persistent High Score.
- **Game Over Screen**: The screen displayed after a Collision ends the game, showing the final Score and High Score.
- **Pause Screen**: An overlay displayed when the player pauses active gameplay, freezing all game state.
- **Game State**: The current mode of the Game — one of: `MENU`, `PLAYING`, `PAUSED`, or `GAME_OVER`.
- **Persistent High Score**: The High Score saved to `localStorage` so it survives page reloads.
- **Canvas**: The HTML5 `<canvas>` element used to render all game visuals.
- **Cloud**: A procedurally drawn background shape rendered with semi-transparency.
- **Parallax**: The visual effect of background layers moving at different speeds to simulate depth.
- **Screen Shake**: A brief camera-offset effect applied to the Canvas when a Collision occurs.
- **Particle**: A small short-lived visual element emitted from Ghosty's position each frame to create a trail effect.
- **Particle Trail**: The continuous stream of Particles emitted behind Ghosty during active gameplay.
- **Score Popup**: A transient "+1" text animation displayed at the pipe gap when a point is scored.
- **Background Music**: A looping ambient audio track played during gameplay.

---

## Requirements

### Requirement 1: Game Initialization and Main Menu

**User Story:** As a player, I want to see a main menu when I open the game, so that I know how to begin and can see my best score.

#### Acceptance Criteria

1. WHEN the browser loads the Game, THE Game SHALL enter the `MENU` Game State and display the Start Screen on the Canvas.
2. THE Start Screen SHALL display the game title "Flappy Kiro" in a retro font.
3. THE Start Screen SHALL display a PLAY button and a HIGH SCORES button, rendered on the canvas with AABB hit detection for click and touch events.
4. THE Start Screen SHALL always display the Persistent High Score, loading it from `localStorage` on startup (showing 0 if none exists).
5. WHEN the player clicks/taps the PLAY button or presses the Space key, THE Game SHALL transition to the `PLAYING` Game State.
6. WHEN the player clicks/taps the HIGH SCORES button, THE Game SHALL display the High Scores overlay showing the Persistent High Score.
7. WHEN the High Scores overlay is open AND the player clicks/taps the CLOSE button or presses Escape, THE Game SHALL dismiss the overlay and return to the `MENU` state.

---

### Requirement 2: Ghosty Physics and Player Input

**User Story:** As a player, I want to control Ghosty with a single button or tap, so that I can navigate through the pipes.

#### Acceptance Criteria

1. WHILE the Game is in active gameplay, THE Game SHALL apply the Gravity Constant to Ghosty's vertical velocity each frame, causing Ghosty to accelerate downward.
2. WHEN the player presses the Space key during active gameplay, THE Game SHALL set Ghosty's vertical velocity to the Ascent Velocity (a fixed upward value), overriding any current downward momentum.
3. WHEN the player taps or clicks the Canvas during active gameplay, THE Game SHALL apply the same Flap impulse as the Space key.
4. THE Game SHALL render Ghosty using the `assets/ghosty.png` sprite at Ghosty's current position each frame.
5. WHILE the Game is in active gameplay, THE Game SHALL rotate Ghosty's sprite to visually reflect the direction of Ghosty's vertical velocity (tilting up on ascent, down on descent).

---

### Requirement 11: Comprehensive Physics System

**User Story:** As a player, I want Ghosty's movement to feel weighty and natural, so that the game is satisfying and skill-based to control.

#### Acceptance Criteria

1. THE Game SHALL define a Gravity Constant (e.g., 0.5 px/frame²) that is applied additively to Ghosty's vertical velocity every frame.
2. THE Game SHALL define an Ascent Velocity (e.g., −8 px/frame) that is assigned to Ghosty's vertical velocity when a Flap is triggered, replacing the current velocity rather than adding to it.
3. THE Game SHALL clamp Ghosty's vertical velocity to a Terminal Velocity (e.g., +10 px/frame downward) so that Ghosty cannot fall faster than this limit regardless of how long it falls.
4. THE Game SHALL preserve Ghosty's current vertical velocity between frames (momentum conservation), so that each frame's velocity is the previous frame's velocity plus the Gravity Constant, subject to the Terminal Velocity clamp.
5. THE Game SHALL update Ghosty's vertical position each frame by adding the current vertical velocity to the previous position, producing smooth frame-by-frame movement.
6. THE Game SHALL use delta-time scaling (elapsed milliseconds since the last frame) to adjust physics updates, so that gameplay speed remains consistent regardless of frame rate variations.
7. THE Gravity Constant, Ascent Velocity, and Terminal Velocity SHALL be defined as named constants in the code, making them easy to tune without searching through logic.

---

### Requirement 3: Pipe Generation and Scrolling

**User Story:** As a player, I want a continuous stream of pipe obstacles with consistent spacing, so that the game presents a fair and ongoing challenge.

#### Acceptance Criteria

1. WHILE the Game is in active gameplay, THE Game SHALL scroll all active Pipe pairs from right to left at the current Pipe Speed each frame.
2. THE Game SHALL define a fixed Pair Spacing (e.g., 220 px) as the horizontal distance between the leading edges of consecutive Pipe pairs, defined as a named constant.
3. THE Game SHALL spawn a new Pipe pair whenever the most recently spawned Pipe pair has scrolled at least one Pair Spacing from the right edge of the Canvas.
4. THE Game SHALL define a fixed Gap Size (e.g., 120 px) that remains constant for all Pipe pairs throughout a session, defined as a named constant.
5. THE Game SHALL randomise the Gap Position for each new Pipe pair, selecting a vertical centre point such that the full Gap remains within the playable area (i.e., at least one pipe-width from the top and bottom canvas edges).
6. THE Game SHALL define a minimum and maximum Gap Position bound to prevent the Gap from appearing too close to the top or bottom of the Canvas.
7. WHEN a Pipe pair scrolls completely off the left edge of the Canvas, THE Game SHALL remove it from the active Pipe list to free memory.

---

### Requirement 12: Progressive Difficulty

**User Story:** As a player, I want the game to get harder as I score more points, so that skilled play is rewarded with a greater challenge.

#### Acceptance Criteria

1. THE Game SHALL define an initial Pipe Speed (e.g., 2 px/frame) applied at the start of each session, defined as a named constant.
2. THE Game SHALL define a Speed Increment (e.g., 0.4 px/frame) and a Score Threshold (e.g., every 5 points) at which Pipe Speed increases, both defined as named constants.
3. WHEN the Score reaches a multiple of the Score Threshold, THE Game SHALL increase the current Pipe Speed by the Speed Increment.
4. THE Game SHALL define a Maximum Pipe Speed (e.g., 6 px/frame) beyond which Pipe Speed SHALL NOT increase, defined as a named constant.
5. THE parallax cloud layers SHALL scale their scroll speeds proportionally when Pipe Speed increases, so the background depth effect remains visually consistent.
6. WHEN the game is restarted, THE Game SHALL reset Pipe Speed to the initial value.

---

### Requirement 4: Collision Detection and Game Over

**User Story:** As a player, I want the game to end when Ghosty hits a pipe or boundary, so that the game has meaningful stakes.

#### Acceptance Criteria

1. THE Game SHALL define Ghosty's Hitbox as an axis-aligned rectangle inset from the sprite edges by a defined margin (e.g., 4 px on all sides), defined as a named constant, so that near-misses feel fair rather than punishing.
2. THE Game SHALL define each Pipe Boundary as the full axis-aligned rectangle of the top or bottom pipe wall, with width equal to the Pipe Width constant.
3. WHEN Ghosty's Hitbox overlaps with any Pipe Boundary, THE Game SHALL trigger a Collision.
4. WHEN Ghosty's Hitbox reaches or crosses the Ground Boundary (bottom canvas edge), THE Game SHALL trigger a Collision.
5. WHEN Ghosty's Hitbox reaches or crosses the Ceiling Boundary (top canvas edge), THE Game SHALL trigger a Collision.
6. WHEN a Collision is triggered AND Invincibility Frames are not active, THE Game SHALL immediately begin the Collision Response and start the Invincibility Frames timer.
7. WHEN Invincibility Frames are active, THE Game SHALL ignore any further Collision detections until the timer expires.
8. THE Invincibility Frames duration SHALL be defined as a named constant (e.g., 500 ms).
9. THE Collision Response SHALL flash Ghosty's sprite (alternating visible/invisible) for the duration of the Invincibility Frames to give the player clear visual feedback.
10. WHEN the Collision Response animation completes, THE Game SHALL stop the Game Loop and display the Game Over Screen.
11. WHEN a Collision is triggered, THE Game SHALL play the `assets/game_over.wav` sound effect.

---

### Requirement 5: Scoring and Persistent High Score

**User Story:** As a player, I want to see my current score in real time and have my best score saved between sessions, so that I can track long-term progress.

#### Acceptance Criteria

1. WHEN Ghosty passes through the Gap of a Pipe pair (i.e., Ghosty's horizontal position clears the right edge of the Pipe), THE Game SHALL increment the Score by 1.
2. WHILE the Game is in the `PLAYING` Game State, THE Game SHALL display the current Score prominently on the Canvas, updating in real time.
3. WHEN a Game Over is triggered, IF the current Score exceeds the Persistent High Score, THEN THE Game SHALL update the Persistent High Score and write it to `localStorage`.
4. THE Game SHALL read the Persistent High Score from `localStorage` on startup so that the High Score survives page reloads and browser restarts.
5. IF `localStorage` is unavailable (e.g., private browsing restrictions), THE Game SHALL fall back to an in-memory High Score for the session without throwing an error.

---

### Requirement 6: Audio Feedback

**User Story:** As a player, I want audio cues for my actions and ambient music during play, so that the game feels responsive and immersive.

#### Acceptance Criteria

1. WHEN the player triggers a Flap, THE Game SHALL play the `assets/jump.wav` sound effect.
2. WHEN a Collision is triggered, THE Game SHALL play the `assets/game_over.wav` sound effect.
3. WHEN the Score increments, THE Game SHALL play a short score sound effect (synthesised via the Web Audio API if no asset is provided, e.g., a brief high-pitched beep).
4. THE Game SHALL play looping Background Music during the `PLAYING` Game State, generated procedurally via the Web Audio API (no external audio file required).
5. WHEN the Game transitions to `PAUSED`, THE Game SHALL pause the Background Music; WHEN the Game resumes to `PLAYING`, THE Game SHALL resume the Background Music from where it stopped.
6. WHEN the Game transitions to `GAME_OVER` or `MENU`, THE Game SHALL stop the Background Music.
7. IF the browser's autoplay policy prevents audio playback before the first user interaction, THE Game SHALL defer all audio initialisation until the first player input event.
8. ALL sound effect volumes and the Background Music volume SHALL be defined as named constants so they can be tuned independently.

---

### Requirement 7: Game Over Screen and Restart

**User Story:** As a player, I want to see my score after dying and be able to restart quickly, so that I can keep playing.

#### Acceptance Criteria

1. WHEN the Game enters the `GAME_OVER` Game State, THE Game SHALL display the Game Over Screen.
2. THE Game Over Screen SHALL display the text "Game Over" in a retro font.
3. THE Game Over Screen SHALL display the final Score achieved in the round.
4. THE Game Over Screen SHALL display the current Persistent High Score.
5. IF the final Score equals the Persistent High Score, THE Game Over Screen SHALL highlight this as a new best (e.g., "New Best!").
6. THE Game Over Screen SHALL display a RESTART button and a MAIN MENU button, rendered on the canvas with AABB hit detection.
7. WHEN the player clicks/taps the RESTART button or presses Space, THE Game SHALL reset all game state (Score, Pipe Speed, Ghosty position/velocity, active Pipes) and transition to the `PLAYING` Game State.
8. WHEN the player clicks/taps the MAIN MENU button, THE Game SHALL transition to the `MENU` Game State.

---

### Requirement 13: Game State Management and Pause

**User Story:** As a player, I want to be able to pause the game and resume where I left off, so that I can take a break without losing my run.

#### Acceptance Criteria

1. THE Game SHALL maintain an explicit Game State variable with four possible values: `MENU`, `PLAYING`, `PAUSED`, and `GAME_OVER`.
2. ALL rendering and update logic SHALL branch on the current Game State, ensuring only the appropriate systems run in each state.
3. WHEN the Game is in the `PLAYING` Game State AND the player presses the Escape key or the P key, THE Game SHALL transition to the `PAUSED` Game State.
4. WHEN the Game is in the `PAUSED` Game State, THE Game SHALL freeze all physics, pipe movement, and cloud scrolling — no game objects SHALL update position.
5. WHEN the Game is in the `PAUSED` Game State, THE Game SHALL display a Pause Screen overlay showing "Paused" and a resume prompt (e.g., "Press Escape or P to Resume").
6. WHEN the Game is in the `PAUSED` Game State AND the player presses Escape or P, THE Game SHALL transition back to the `PLAYING` Game State and resume all updates from the frozen state.
7. WHEN the Game transitions between any states, THE Game SHALL cleanly enter and exit each state with no residual input events carried over (e.g., a Space press that starts the game SHALL NOT also trigger a Flap).

---

### Requirement 14: Visual Feedback Effects

**User Story:** As a player, I want visual reactions to my actions and game events, so that the game feels alive and satisfying to play.

#### Acceptance Criteria

1. WHEN a Collision is triggered, THE Game SHALL apply a Screen Shake effect by randomly offsetting the Canvas render origin for a short duration (e.g., 300 ms), with the shake magnitude defined as a named constant.
2. THE Screen Shake magnitude SHALL decay smoothly to zero over its duration rather than cutting off abruptly.
3. WHILE the Game is in the `PLAYING` Game State, THE Game SHALL emit Particles from Ghosty's trailing edge each frame to create a Particle Trail.
4. EACH Particle SHALL have a randomised initial velocity, a short lifespan (e.g., 20–40 frames), and SHALL fade in opacity as it ages, defined via named constants.
5. THE Particle Trail colour SHALL complement the retro aesthetic (e.g., semi-transparent white or light blue).
6. WHEN the Score increments, THE Game SHALL display a Score Popup ("+1") at the position of the scored pipe gap, animating upward and fading out over a short duration (e.g., 600 ms).
7. THE Score Popup SHALL use the same retro font as all other on-screen text.
8. WHEN the Game is in the `PAUSED` Game State, THE Game SHALL freeze all active Particles and Score Popups in place — they SHALL NOT update or fade while paused.
9. ALL visual effect durations, magnitudes, and particle properties SHALL be defined as named constants.

---

### Requirement 8: Retro Visual Aesthetic

**User Story:** As a player, I want the game to look retro and pixel-art styled, so that it has a distinct and charming visual identity.

#### Acceptance Criteria

1. THE Game SHALL use a pixel-art or retro-style font for all on-screen text.
2. THE Game SHALL render Pipes with a retro color scheme consistent with the example UI in `img/example-ui.png`.
3. THE Game SHALL render a scrolling background that complements the retro aesthetic.
4. THE Canvas SHALL have a fixed resolution appropriate for the game layout (e.g., 480×640 or similar), centered in the browser viewport.
5. THE Game SHALL scale the Canvas to fit smaller viewports without distorting the aspect ratio.

---

### Requirement 10: Parallax Cloud Background

**User Story:** As a player, I want to see clouds drifting at different speeds in the background, so that the game feels immersive and has a sense of depth.

#### Acceptance Criteria

1. THE Game SHALL render multiple clouds in the background, drawn procedurally using canvas shapes (no external image asset required).
2. THE Game SHALL organise clouds into at least two distinct layers, each scrolling at a different horizontal speed to create a parallax depth effect.
3. Clouds in layers further from the viewer SHALL scroll slower and appear smaller than clouds in layers closer to the viewer.
4. ALL clouds SHALL be rendered with semi-transparency (alpha < 1.0) so the background colour shows through.
5. WHEN a cloud scrolls completely off the left edge of the Canvas, THE Game SHALL wrap or respawn it at the right edge to maintain a continuous cloud field.
6. THE cloud layers SHALL scroll continuously during active gameplay, the Start Screen, and the Game Over Screen.

---

### Requirement 9: Single-File or Minimal-File Browser Delivery

**User Story:** As a developer, I want the game to run from a single HTML file (or minimal files), so that it is easy to distribute and play without a build step.

#### Acceptance Criteria

1. THE Game SHALL be playable by opening an HTML file directly in a modern browser with no server or build tool required.
2. THE Game SHALL load the `assets/ghosty.png`, `assets/jump.wav`, and `assets/game_over.wav` files using relative paths.
3. IF an asset fails to load, THEN THE Game SHALL continue to function using a fallback (e.g., a colored rectangle in place of the sprite, silent audio).
