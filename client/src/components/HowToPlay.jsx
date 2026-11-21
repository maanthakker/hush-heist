const CARDS = [
  ['noise', 'Stay quiet', 'Tiptoe is silent, walking is quiet, running is loud. Rings on the floor show how far a sound carries.'],
  ['wake', 'Watch the wake meters', 'Noise fills the bar over each sleeper. If one fills all the way, they wake up and the heist is off.'],
  ['shh', 'Use the Shh', 'Finger to lips: a silence wave calms anyone about to wake and cancels noise around you for 3 seconds. Then it recharges for 10.'],
  ['traps', 'Mind the traps', 'Light, cracked boards creak. Toys squeak. Doors creak if you rush. Tiptoe over them.'],
  ['cones', 'Stay out of the light', 'The cat, the robots and Grandpa’s open eye see in a cone. Stand in it too long and they make a racket.'],
  ['hide', 'Hide', 'Curtains, tables, closets, boxes, even under the car. While hidden, nothing can see you.'],
];

const MODES = [
  ['Co-op Heist', 'Grab the snacks together. Everyone has to make it back.'],
  ['Hide & Seek', 'The Night Guard counts to ten, then hunts with a flashlight. Hiders win if anyone lasts 90 seconds.'],
  ['Fridge Race', 'First to the fridge wins. Wake someone or get spotted and you go back to the start.'],
];

export default function HowToPlay() {
  return (
    <div className="howto">
      <ul className="howto-grid">
        {CARDS.map(([icon, title, text]) => (
          <li key={icon} className="howto-card">
            <span className={`howto-icon icon-${icon}`} aria-hidden="true" />
            <strong>{title}</strong>
            <p>{text}</p>
          </li>
        ))}
      </ul>
      <h3>Modes</h3>
      <dl className="howto-modes">
        {MODES.map(([name, text]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <h3>Earn and unlock</h3>
      <p className="muted">Snacks, stars and wins earn coins. Spend them in the Locker on outfits and hair colors. Clear a level to unlock the next one.</p>
    </div>
  );
}
