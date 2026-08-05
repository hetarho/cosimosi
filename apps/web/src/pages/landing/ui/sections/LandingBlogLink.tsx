import { m } from '../../../../shared/i18n/index.ts'

// One restrained line for the reader who wants the depth. Nothing else on the page competes with it, and
// nothing here tries to summarize what it leads to — the blog is where the papers are allowed to be.
export function LandingBlogLink() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-10">
      <h2 className="break-keep text-lg font-semibold text-text">{m.landing_blog_title()}</h2>
      <p className="max-w-measure text-sm leading-6 text-text-muted">{m.landing_blog_body()}</p>
      {/* Absolute path, plain anchor — the blog is Worker-served static HTML outside this router.
          Same step below its body as the theory cards' link, so the page's two "read on" affordances
          read as one thing. */}
      <a
        href="/blog/"
        className="self-start rounded-sm py-1.5 text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {m.landing_blog_action()}
      </a>
    </section>
  )
}
