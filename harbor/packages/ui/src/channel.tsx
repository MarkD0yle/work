import { USER_CHANNELS, findUserChannel } from '@harbor/schemas'
import { Menu } from './overlays.tsx'

/** Coloured square with a letter, so a channel is never identified by colour alone. */
export function ChannelDot({ channelId }: { channelId: string | null }) {
  const channel = findUserChannel(channelId)
  return (
    <span className={`hb-channel-dot${channel ? '' : ' is-none'}`} style={channel ? { background: channel.displayMetadata.color, color: channel.displayMetadata.textColor } : undefined} aria-hidden="true">
      {channel?.displayMetadata.glyph ?? '–'}
    </span>
  )
}

export function ChannelPicker({ channelId, onChange, subject }: { channelId: string | null; onChange: (channelId: string | null) => void; subject: string }) {
  const current = findUserChannel(channelId)
  return (
    <Menu
      label={`Channel for ${subject}: ${current?.displayMetadata.name ?? 'none'}`}
      triggerClassName="hb-channel-trigger"
      trigger={<ChannelDot channelId={channelId} />}
      header="Link to channel"
      items={[
        ...USER_CHANNELS.map((c) => ({
          id: c.id,
          checked: c.id === channelId,
          onSelect: () => onChange(c.id),
          label: (
            <span className="hb-channel-option">
              <ChannelDot channelId={c.id} />
              {c.displayMetadata.name}
            </span>
          ),
        })),
        { id: 'none', checked: channelId === null, separated: true, onSelect: () => onChange(null), label: <span className="hb-channel-option"><ChannelDot channelId={null} />No channel</span> },
      ]}
    />
  )
}
