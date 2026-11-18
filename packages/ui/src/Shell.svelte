<script lang="ts">
  // Until launch, /play/ says the game is coming and points to the site
  // (website spec §7.2, #332). It shows both site languages, each marked
  // with its `lang`, read from the UI catalogue (#104).
  import { parts, t, type UiKey, type UiLocale } from './i18n/catalogue';

  const sections: readonly { locale: UiLocale; prefix: string }[] = [
    { locale: 'en', prefix: '' },
    { locale: 'id', prefix: '/id' },
  ];

  const links: Readonly<Record<string, { key: UiKey; path: string }>> = {
    roadmap: { key: 'shell.followRoadmap', path: '/roadmap' },
    launchList: { key: 'shell.joinLaunchList', path: '/#launch-list' },
  };
</script>

<main>
  <h1>{t('en', 'game.name')}</h1>
  {#each sections as { locale, prefix } (locale)}
    <section lang={locale}>
      <p>{t(locale, 'shell.comingSoon')}</p>
      <p>
        {#each parts(locale, 'shell.next') as part, index (index)}
          {#if 'slot' in part}
            {@const link = links[part.slot]}
            {#if link !== undefined}
              <a href={`${prefix}${link.path}`}>{t(locale, link.key)}</a>
            {/if}
          {:else}
            {part.text}
          {/if}
        {/each}
      </p>
    </section>
  {/each}
</main>
