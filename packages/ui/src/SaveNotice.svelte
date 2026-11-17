<script lang="ts">
  // What the player is told when the latest save does not load (#160 AC3;
  // spec §6.5, DN18, H20): a restored backup names how far back it went, and
  // when every copy is damaged the player chooses; nothing is reset silently.
  import { t, type UiLocale } from './i18n/catalogue';
  import { savedAgo } from './saved-ago';

  export type SaveNoticeKind =
    { kind: 'restored'; savedAt: number } | { kind: 'allDamaged' };

  interface Props {
    locale: UiLocale;
    notice: SaveNoticeKind;
    now: number;
    onStartNew?: () => void;
    onKeepAndClose?: () => void;
  }

  const { locale, notice, now, onStartNew, onKeepAndClose }: Props = $props();
</script>

{#if notice.kind === 'restored'}
  <p role="status" lang={locale}>
    {t(locale, 'save.restored', {
      when: savedAgo(locale, notice.savedAt, now),
    })}
  </p>
{:else}
  <div role="alertdialog" aria-labelledby="save-damaged" lang={locale}>
    <p id="save-damaged">{t(locale, 'save.allDamaged')}</p>
    <button type="button" onclick={onStartNew}
      >{t(locale, 'save.startNew')}</button
    >
    <button type="button" onclick={onKeepAndClose}
      >{t(locale, 'save.keepAndClose')}</button
    >
  </div>
{/if}
