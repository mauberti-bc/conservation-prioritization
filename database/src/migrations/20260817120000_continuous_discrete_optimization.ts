import { Knex } from 'knex';

export const config = { transaction: false };

/**
 * Split optimization into explicit continuous and discrete task/run contracts.
 *
 * @param {Knex} knex Database connection.
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET search_path=conservation,public;

    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'continuous_optimization';
    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'discrete_optimization';
    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'priority_ranking';
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'compiled_continuous_optimization';
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'compiled_discrete_optimization';
    ALTER TYPE task_run_execution_method ADD VALUE IF NOT EXISTS 'compiled_priority_ranking';
  `);

  await knex.raw(`--sql
    SET search_path=conservation,public;

    UPDATE task
    SET type = 'discrete_optimization'::task_type
    WHERE type::text = 'optimization';

    UPDATE task_run
    SET task_type = 'discrete_optimization'::task_type,
        execution_method = 'compiled_discrete_optimization'::task_run_execution_method,
        execution_method_version = 'highs-csr-discrete-v1',
        input_snapshot = jsonb_set(
          jsonb_set(
            jsonb_set(input_snapshot, '{task_type}', '"discrete_optimization"', true),
            '{decision_type}',
            '"binary"',
            true
          ),
          '{decision_domain}',
          '"discrete"',
          true
        )
    WHERE task_type::text = 'optimization'
       OR execution_method::text = 'compiled_optimization';

    ALTER TABLE task ALTER COLUMN type SET DEFAULT 'discrete_optimization'::task_type;
  `);
}

/**
 * Keep additive enum values on rollback.
 *
 * @param {Knex} _knex Database connection.
 * @returns {Promise<void>}
 */
export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL enum values are intentionally retained on rollback.
}
