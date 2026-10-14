import type { BetterAuthOptions } from "better-auth";
import {
  createAdapterFactory,
  type AdapterFactory,
  type CleanedWhere,
  type CustomAdapter,
} from "better-auth/adapters";
import {
  And,
  Equal,
  FindOperator,
  ILike,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  type DataSource,
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral,
} from "typeorm";

type WhereObject = Record<string, FindOperator<unknown>>;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

function toOperator(clause: CleanedWhere): FindOperator<unknown> {
  const { operator, value, mode } = clause;
  const insensitive = mode === "insensitive" && typeof value === "string";
  const like = (pattern: string) =>
    insensitive ? ILike(pattern) : Like(pattern);
  const list = (): readonly (string | number)[] => {
    if (!Array.isArray(value)) {
      throw new TypeError(`The "${operator}" operator needs an array value`);
    }
    return value;
  };

  switch (operator) {
    case "eq":
      if (value === null) return IsNull();
      return insensitive ? ILike(escapeLike(value)) : Equal(value);
    case "ne":
      if (value === null) return Not(IsNull());
      return Not(insensitive ? ILike(escapeLike(value)) : value);
    case "lt":
      return LessThan(value);
    case "lte":
      return LessThanOrEqual(value);
    case "gt":
      return MoreThan(value);
    case "gte":
      return MoreThanOrEqual(value);
    case "in":
      return In(list());
    case "not_in":
      return Not(In(list()));
    case "contains":
      return like(`%${escapeLike(String(value))}%`);
    case "starts_with":
      return like(`${escapeLike(String(value))}%`);
    case "ends_with":
      return like(`%${escapeLike(String(value))}`);
    default:
      throw new Error(`Unsupported where operator: ${String(operator)}`);
  }
}

function addCondition(target: WhereObject, clause: CleanedWhere) {
  const condition = toOperator(clause);
  const existing = target[clause.field];
  target[clause.field] = existing ? And(existing, condition) : condition;
}

/**
 * Converts Better Auth where clauses into TypeORM find conditions:
 * `(AND clauses) AND (OR clause 1 OR OR clause 2 ...)`, expressed as an array
 * of where objects (which TypeORM ORs together).
 */
function toWhere(where: CleanedWhere[] = []): WhereObject | WhereObject[] {
  const andClauses = where.filter((clause) => clause.connector !== "OR");
  const orClauses = where.filter((clause) => clause.connector === "OR");

  const base: WhereObject = {};
  for (const clause of andClauses) addCondition(base, clause);
  if (orClauses.length === 0) return base;

  return orClauses.map((clause) => {
    const branch = { ...base };
    addCondition(branch, clause);
    return branch;
  });
}

function toSelect(select?: string[]) {
  return select?.length
    ? Object.fromEntries(select.map((field) => [field, true]))
    : undefined;
}

/** Maps Better Auth model keys (`user`, `session`, ...) to TypeORM entities. */
export type TypeormAdapterModels = Record<string, EntityTarget<ObjectLiteral>>;

type ModelTarget = { model: string; modelKey?: string | undefined };

function createTypeormAdapter(
  manager: EntityManager,
  models: TypeormAdapterModels,
): CustomAdapter {
  const repo = ({ model, modelKey = model }: ModelTarget) => {
    const entity = models[modelKey];
    if (!entity) {
      throw new Error(`No TypeORM entity is mapped to model "${modelKey}"`);
    }
    return manager.getRepository(entity);
  };

  const findIds = async (target: ModelTarget, where: CleanedWhere[]) => {
    const rows = await repo(target).find({
      where: toWhere(where),
      select: { id: true },
    });
    return rows.map((row): unknown => row.id);
  };

  // The casts below are deliberate. Better Auth's adapter methods are generic
  // in the row type the caller expects (`findOne<T>(...): Promise<T | null>`),
  // which an implementation can't produce from TypeORM's `ObjectLiteral` rows
  // without a cast; Better Auth's adapter factory transforms the rows into its
  // own types afterwards. Typing the repository as `Repository<any>` instead
  // would only trade these casts for an `any` that reaches every method.
  return {
    async create({ model, modelKey, data }) {
      const repository = repo({ model, modelKey });
      return (await repository.save(repository.create(data))) as typeof data;
    },
    async findOne({ model, modelKey, where, select }) {
      return (await repo({ model, modelKey }).findOne({
        where: toWhere(where),
        select: toSelect(select),
      })) as never;
    },
    async findMany({ model, modelKey, where, limit, offset, sortBy, select }) {
      return (await repo({ model, modelKey }).find({
        where: toWhere(where),
        take: limit,
        skip: offset,
        order: sortBy
          ? { [sortBy.field]: sortBy.direction === "asc" ? "ASC" : "DESC" }
          : undefined,
        select: toSelect(select),
      })) as never;
    },
    async count({ model, modelKey, where }) {
      return repo({ model, modelKey }).count({
        where: toWhere(where),
      });
    },
    async update({ model, modelKey, where, update }) {
      if (typeof update !== "object" || update === null) {
        throw new TypeError("The update must be an object of fields");
      }
      const repository = repo({ model, modelKey });
      const row = await repository.findOne({ where: toWhere(where) });
      if (!row) return null;
      await repository.update({ id: row.id }, update);
      return (await repository.findOneBy({ id: row.id })) as never;
    },
    async updateMany({ model, modelKey, where, update }) {
      const ids = await findIds({ model, modelKey }, where);
      if (ids.length === 0) return 0;
      await repo({ model, modelKey }).update({ id: In(ids) }, update);
      return ids.length;
    },
    async delete({ model, modelKey, where }) {
      const ids = await findIds({ model, modelKey }, where);
      if (ids.length > 0)
        await repo({ model, modelKey }).delete({ id: ids[0] });
    },
    async deleteMany({ model, modelKey, where }) {
      const ids = await findIds({ model, modelKey }, where);
      if (ids.length === 0) return 0;
      await repo({ model, modelKey }).delete({ id: In(ids) });
      return ids.length;
    },
  };
}

/**
 * Better Auth database adapter backed by a TypeORM data source. Entities are
 * looked up by Better Auth model key, so table and schema names are up to the
 * entity definitions.
 */
export function typeormAdapter(
  dataSource: DataSource,
  models: TypeormAdapterModels,
) {
  let options: BetterAuthOptions | null = null;
  const initializedOptions = () => {
    if (!options) {
      throw new Error("Better Auth hasn't initialized the TypeORM adapter yet");
    }
    return options;
  };

  const buildFactory = (
    manager: EntityManager,
  ): AdapterFactory<BetterAuthOptions> =>
    createAdapterFactory({
      config: {
        adapterId: "typeorm",
        adapterName: "TypeORM Adapter",
        usePlural: false,
        supportsJSON: true,
        supportsDates: true,
        supportsBooleans: true,
        transaction: (callback) =>
          dataSource.transaction((transactionManager) =>
            callback(buildFactory(transactionManager)(initializedOptions())),
          ),
      },
      adapter: () => createTypeormAdapter(manager, models),
    });

  const factory = buildFactory(dataSource.manager);
  return (authOptions: BetterAuthOptions) => {
    options = authOptions;
    return factory(authOptions);
  };
}
