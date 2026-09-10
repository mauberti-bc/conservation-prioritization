import { Knex } from 'knex';

const tutorialMarkdown = `
# Tutorial

## Conservation planning workflow

Use this tutorial to submit conservation problems and compare priority areas.

- Define an area of interest
- Select landscape characteristics and assign weights
- Submit a conservation problem
- Review priority areas
`.trim();

/**
 * Creates application-managed Markdown documents and seeds the tutorial content.
 *
 * @param {Knex} knex Migration database connection.
 * @returns {Promise<void>} Resolves after the table, triggers, and tutorial row are created.
 * @throws {Error} When PostgreSQL rejects the schema or seed changes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    CREATE TABLE markdown (
      markdown_id uuid DEFAULT gen_random_uuid(),
      key text NOT NULL,
      data text NOT NULL,
      created_at timestamptz(6) DEFAULT now() NOT NULL,
      created_by uuid,
      updated_at timestamptz(6),
      updated_by uuid,
      CONSTRAINT markdown_pk PRIMARY KEY (markdown_id),
      CONSTRAINT markdown_key_uk UNIQUE (key),
      CONSTRAINT markdown_created_by_fk FOREIGN KEY (created_by) REFERENCES profile(profile_id),
      CONSTRAINT markdown_updated_by_fk FOREIGN KEY (updated_by) REFERENCES profile(profile_id)
    );

    COMMENT ON TABLE markdown IS 'Application-managed Markdown documents.';
    COMMENT ON COLUMN markdown.markdown_id IS 'System generated UUID primary key.';
    COMMENT ON COLUMN markdown.key IS 'Stable application identifier for the Markdown document.';
    COMMENT ON COLUMN markdown.data IS 'Raw Markdown source.';
    COMMENT ON COLUMN markdown.created_at IS 'The datetime the record was created.';
    COMMENT ON COLUMN markdown.created_by IS 'The id of the profile who created the record.';
    COMMENT ON COLUMN markdown.updated_at IS 'The datetime the record was updated.';
    COMMENT ON COLUMN markdown.updated_by IS 'The id of the profile who updated the record.';

    CREATE TRIGGER trg_journal_markdown
      BEFORE INSERT OR UPDATE OR DELETE ON markdown
      FOR EACH ROW EXECUTE FUNCTION tr_journal_trigger();

    CREATE TRIGGER trg_audit_markdown
      AFTER INSERT OR UPDATE OR DELETE ON markdown
      FOR EACH ROW EXECUTE FUNCTION tr_audit_trigger();
  `);

  await knex('markdown').withSchema('conservation').insert({
    key: 'tutorial',
    data: tutorialMarkdown
  });
}

/**
 * Removes the Markdown document table.
 *
 * @param {Knex} knex Migration database connection.
 * @returns {Promise<void>} Resolves after the Markdown schema objects are removed.
 * @throws {Error} When PostgreSQL rejects the rollback statement.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    DROP TRIGGER IF EXISTS trg_audit_markdown ON markdown;
    DROP TRIGGER IF EXISTS trg_journal_markdown ON markdown;
    DROP TABLE IF EXISTS markdown;
  `);
}
