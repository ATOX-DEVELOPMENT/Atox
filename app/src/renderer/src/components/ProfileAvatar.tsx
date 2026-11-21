interface ProfileAvatarProps {
  /** Фото профиля (data URL); пусто — показывается первая буква имени. */
  image: string
  name: string | undefined
  /** Крупный вариант для настроек. */
  large?: boolean
}

/** Круглая аватарка: фото, а без него — буква имени на градиенте. */
export function ProfileAvatar({ image, name, large = false }: ProfileAvatarProps) {
  return (
    <span className={large ? 'profile-avatar profile-avatar--large' : 'profile-avatar'} aria-hidden>
      {image ? <img src={image} alt="" draggable={false} /> : name?.charAt(0).toUpperCase()}
    </span>
  )
}
