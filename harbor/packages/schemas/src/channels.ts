/** The eight fixed user channels. Ids follow the FDC3 `fdc3.channel.N` convention. */
export interface UserChannel {
  id: string
  type: 'user'
  displayMetadata: { name: string; color: string; glyph: string }
}

const def = (n: number, name: string, glyph: string): UserChannel => ({
  id: `fdc3.channel.${n}`,
  type: 'user',
  // `color` is a token reference so no component hard-codes a hue.
  displayMetadata: { name, color: `var(--color-channel-${name.toLowerCase()})`, glyph },
})

export const USER_CHANNELS: readonly UserChannel[] = [
  def(1, 'Red', 'R'),
  def(2, 'Orange', 'O'),
  def(3, 'Yellow', 'Y'),
  def(4, 'Green', 'G'),
  def(5, 'Cyan', 'C'),
  def(6, 'Blue', 'B'),
  def(7, 'Magenta', 'M'),
  def(8, 'Purple', 'P'),
]

export function findUserChannel(id: string | null | undefined): UserChannel | undefined {
  return USER_CHANNELS.find((c) => c.id === id)
}
