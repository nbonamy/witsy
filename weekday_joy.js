// "Weekday Joy" - Original Upbeat Composition
stack(
  // Bouncy bass line
  note("c3 c3 g2 g2 a#2 a#2 f2 f2")
    .sound("sine")
    .sustain(0.3)
    .decay(0.2)
    .gain(0.7),

  // Catchy lead riff
  note("g4 g4 a#4 [rest g4] f4 g4 c5 a#4 g4")
    .sound("square")
    .sustain(0.2)
    .decay(0.15)
    .gain(0.6),

  // Rhythmic chords
  note("c4 [rest] c4 [rest]")
    .sound("triangle")
    .sustain(0.35)
    .decay(0.2)
    .gain(0.4),

  // Upbeat drum groove
  stack(
    sound("bd").every(1, x => x.gain(0.6)),
    sound("hh").gain(0.3),
    sound("clap").delay(0.5).gain(0.5)
  )
)
  .bpm(120)
