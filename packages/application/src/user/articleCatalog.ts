import type * as Domain from "@es-ts-example/domain";

export type ArticleCatalogEntry = {
  readonly articleId: Domain.ArticleId;
  readonly title: string;
};

export const articleCatalog: ReadonlyArray<ArticleCatalogEntry> = [
  {
    articleId: "events-over-state" as Domain.ArticleId,
    title: "Events Over State",
  },
  {
    articleId: "effective-boundaries" as Domain.ArticleId,
    title: "Effective Boundaries",
  },
  {
    articleId: "projections-as-products" as Domain.ArticleId,
    title: "Projections Are Products",
  },
  {
    articleId: "small-batches" as Domain.ArticleId,
    title: "Small Batches, Fast Feedback",
  },
  {
    articleId: "boring-software" as Domain.ArticleId,
    title: "The Value of Boring Software",
  },
];
