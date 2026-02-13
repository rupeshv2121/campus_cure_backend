
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model StudentProfile
 * 
 */
export type StudentProfile = $Result.DefaultSelection<Prisma.$StudentProfilePayload>
/**
 * Model FacultyProfile
 * 
 */
export type FacultyProfile = $Result.DefaultSelection<Prisma.$FacultyProfilePayload>
/**
 * Model AdminProfile
 * 
 */
export type AdminProfile = $Result.DefaultSelection<Prisma.$AdminProfilePayload>
/**
 * Model Doubt
 * 
 */
export type Doubt = $Result.DefaultSelection<Prisma.$DoubtPayload>
/**
 * Model Answer
 * 
 */
export type Answer = $Result.DefaultSelection<Prisma.$AnswerPayload>
/**
 * Model Complaint
 * 
 */
export type Complaint = $Result.DefaultSelection<Prisma.$ComplaintPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const Role: {
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
};

export type Role = (typeof Role)[keyof typeof Role]


export const ApprovalStatus: {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus]


export const Subject: {
  DSA: 'DSA',
  DBMS: 'DBMS',
  OS: 'OS',
  NETWORKS: 'NETWORKS'
};

export type Subject = (typeof Subject)[keyof typeof Subject]


export const DoubtStatus: {
  OPEN: 'OPEN',
  ANSWERED: 'ANSWERED',
  RESOLVED: 'RESOLVED'
};

export type DoubtStatus = (typeof DoubtStatus)[keyof typeof DoubtStatus]


export const ComplaintCategory: {
  PROJECTOR: 'PROJECTOR',
  FAN: 'FAN',
  LIGHT: 'LIGHT',
  SMART_BOARD: 'SMART_BOARD',
  SEATING: 'SEATING'
};

export type ComplaintCategory = (typeof ComplaintCategory)[keyof typeof ComplaintCategory]


export const ComplaintStatus: {
  RAISED: 'RAISED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus]


export const AdminLevel: {
  SUPER: 'SUPER',
  NORMAL: 'NORMAL'
};

export type AdminLevel = (typeof AdminLevel)[keyof typeof AdminLevel]

}

export type Role = $Enums.Role

export const Role: typeof $Enums.Role

export type ApprovalStatus = $Enums.ApprovalStatus

export const ApprovalStatus: typeof $Enums.ApprovalStatus

export type Subject = $Enums.Subject

export const Subject: typeof $Enums.Subject

export type DoubtStatus = $Enums.DoubtStatus

export const DoubtStatus: typeof $Enums.DoubtStatus

export type ComplaintCategory = $Enums.ComplaintCategory

export const ComplaintCategory: typeof $Enums.ComplaintCategory

export type ComplaintStatus = $Enums.ComplaintStatus

export const ComplaintStatus: typeof $Enums.ComplaintStatus

export type AdminLevel = $Enums.AdminLevel

export const AdminLevel: typeof $Enums.AdminLevel

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.studentProfile`: Exposes CRUD operations for the **StudentProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more StudentProfiles
    * const studentProfiles = await prisma.studentProfile.findMany()
    * ```
    */
  get studentProfile(): Prisma.StudentProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.facultyProfile`: Exposes CRUD operations for the **FacultyProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more FacultyProfiles
    * const facultyProfiles = await prisma.facultyProfile.findMany()
    * ```
    */
  get facultyProfile(): Prisma.FacultyProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.adminProfile`: Exposes CRUD operations for the **AdminProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AdminProfiles
    * const adminProfiles = await prisma.adminProfile.findMany()
    * ```
    */
  get adminProfile(): Prisma.AdminProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.doubt`: Exposes CRUD operations for the **Doubt** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Doubts
    * const doubts = await prisma.doubt.findMany()
    * ```
    */
  get doubt(): Prisma.DoubtDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.answer`: Exposes CRUD operations for the **Answer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Answers
    * const answers = await prisma.answer.findMany()
    * ```
    */
  get answer(): Prisma.AnswerDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.complaint`: Exposes CRUD operations for the **Complaint** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Complaints
    * const complaints = await prisma.complaint.findMany()
    * ```
    */
  get complaint(): Prisma.ComplaintDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.3.0
   * Query Engine version: 9d6ad21cbbceab97458517b147a6a09ff43aa735
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    StudentProfile: 'StudentProfile',
    FacultyProfile: 'FacultyProfile',
    AdminProfile: 'AdminProfile',
    Doubt: 'Doubt',
    Answer: 'Answer',
    Complaint: 'Complaint'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "studentProfile" | "facultyProfile" | "adminProfile" | "doubt" | "answer" | "complaint"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      StudentProfile: {
        payload: Prisma.$StudentProfilePayload<ExtArgs>
        fields: Prisma.StudentProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.StudentProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.StudentProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>
          }
          findFirst: {
            args: Prisma.StudentProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.StudentProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>
          }
          findMany: {
            args: Prisma.StudentProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>[]
          }
          create: {
            args: Prisma.StudentProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>
          }
          createMany: {
            args: Prisma.StudentProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.StudentProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>[]
          }
          delete: {
            args: Prisma.StudentProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>
          }
          update: {
            args: Prisma.StudentProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>
          }
          deleteMany: {
            args: Prisma.StudentProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.StudentProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.StudentProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>[]
          }
          upsert: {
            args: Prisma.StudentProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StudentProfilePayload>
          }
          aggregate: {
            args: Prisma.StudentProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateStudentProfile>
          }
          groupBy: {
            args: Prisma.StudentProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<StudentProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.StudentProfileCountArgs<ExtArgs>
            result: $Utils.Optional<StudentProfileCountAggregateOutputType> | number
          }
        }
      }
      FacultyProfile: {
        payload: Prisma.$FacultyProfilePayload<ExtArgs>
        fields: Prisma.FacultyProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FacultyProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FacultyProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>
          }
          findFirst: {
            args: Prisma.FacultyProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FacultyProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>
          }
          findMany: {
            args: Prisma.FacultyProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>[]
          }
          create: {
            args: Prisma.FacultyProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>
          }
          createMany: {
            args: Prisma.FacultyProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FacultyProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>[]
          }
          delete: {
            args: Prisma.FacultyProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>
          }
          update: {
            args: Prisma.FacultyProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>
          }
          deleteMany: {
            args: Prisma.FacultyProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FacultyProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.FacultyProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>[]
          }
          upsert: {
            args: Prisma.FacultyProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FacultyProfilePayload>
          }
          aggregate: {
            args: Prisma.FacultyProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFacultyProfile>
          }
          groupBy: {
            args: Prisma.FacultyProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<FacultyProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.FacultyProfileCountArgs<ExtArgs>
            result: $Utils.Optional<FacultyProfileCountAggregateOutputType> | number
          }
        }
      }
      AdminProfile: {
        payload: Prisma.$AdminProfilePayload<ExtArgs>
        fields: Prisma.AdminProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AdminProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AdminProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>
          }
          findFirst: {
            args: Prisma.AdminProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AdminProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>
          }
          findMany: {
            args: Prisma.AdminProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>[]
          }
          create: {
            args: Prisma.AdminProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>
          }
          createMany: {
            args: Prisma.AdminProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AdminProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>[]
          }
          delete: {
            args: Prisma.AdminProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>
          }
          update: {
            args: Prisma.AdminProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>
          }
          deleteMany: {
            args: Prisma.AdminProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AdminProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AdminProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>[]
          }
          upsert: {
            args: Prisma.AdminProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AdminProfilePayload>
          }
          aggregate: {
            args: Prisma.AdminProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAdminProfile>
          }
          groupBy: {
            args: Prisma.AdminProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<AdminProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.AdminProfileCountArgs<ExtArgs>
            result: $Utils.Optional<AdminProfileCountAggregateOutputType> | number
          }
        }
      }
      Doubt: {
        payload: Prisma.$DoubtPayload<ExtArgs>
        fields: Prisma.DoubtFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DoubtFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DoubtFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>
          }
          findFirst: {
            args: Prisma.DoubtFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DoubtFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>
          }
          findMany: {
            args: Prisma.DoubtFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>[]
          }
          create: {
            args: Prisma.DoubtCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>
          }
          createMany: {
            args: Prisma.DoubtCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DoubtCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>[]
          }
          delete: {
            args: Prisma.DoubtDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>
          }
          update: {
            args: Prisma.DoubtUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>
          }
          deleteMany: {
            args: Prisma.DoubtDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DoubtUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DoubtUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>[]
          }
          upsert: {
            args: Prisma.DoubtUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DoubtPayload>
          }
          aggregate: {
            args: Prisma.DoubtAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDoubt>
          }
          groupBy: {
            args: Prisma.DoubtGroupByArgs<ExtArgs>
            result: $Utils.Optional<DoubtGroupByOutputType>[]
          }
          count: {
            args: Prisma.DoubtCountArgs<ExtArgs>
            result: $Utils.Optional<DoubtCountAggregateOutputType> | number
          }
        }
      }
      Answer: {
        payload: Prisma.$AnswerPayload<ExtArgs>
        fields: Prisma.AnswerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AnswerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AnswerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>
          }
          findFirst: {
            args: Prisma.AnswerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AnswerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>
          }
          findMany: {
            args: Prisma.AnswerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>[]
          }
          create: {
            args: Prisma.AnswerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>
          }
          createMany: {
            args: Prisma.AnswerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AnswerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>[]
          }
          delete: {
            args: Prisma.AnswerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>
          }
          update: {
            args: Prisma.AnswerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>
          }
          deleteMany: {
            args: Prisma.AnswerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AnswerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AnswerUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>[]
          }
          upsert: {
            args: Prisma.AnswerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AnswerPayload>
          }
          aggregate: {
            args: Prisma.AnswerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAnswer>
          }
          groupBy: {
            args: Prisma.AnswerGroupByArgs<ExtArgs>
            result: $Utils.Optional<AnswerGroupByOutputType>[]
          }
          count: {
            args: Prisma.AnswerCountArgs<ExtArgs>
            result: $Utils.Optional<AnswerCountAggregateOutputType> | number
          }
        }
      }
      Complaint: {
        payload: Prisma.$ComplaintPayload<ExtArgs>
        fields: Prisma.ComplaintFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ComplaintFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ComplaintFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>
          }
          findFirst: {
            args: Prisma.ComplaintFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ComplaintFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>
          }
          findMany: {
            args: Prisma.ComplaintFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>[]
          }
          create: {
            args: Prisma.ComplaintCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>
          }
          createMany: {
            args: Prisma.ComplaintCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ComplaintCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>[]
          }
          delete: {
            args: Prisma.ComplaintDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>
          }
          update: {
            args: Prisma.ComplaintUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>
          }
          deleteMany: {
            args: Prisma.ComplaintDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ComplaintUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ComplaintUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>[]
          }
          upsert: {
            args: Prisma.ComplaintUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComplaintPayload>
          }
          aggregate: {
            args: Prisma.ComplaintAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateComplaint>
          }
          groupBy: {
            args: Prisma.ComplaintGroupByArgs<ExtArgs>
            result: $Utils.Optional<ComplaintGroupByOutputType>[]
          }
          count: {
            args: Prisma.ComplaintCountArgs<ExtArgs>
            result: $Utils.Optional<ComplaintCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    studentProfile?: StudentProfileOmit
    facultyProfile?: FacultyProfileOmit
    adminProfile?: AdminProfileOmit
    doubt?: DoubtOmit
    answer?: AnswerOmit
    complaint?: ComplaintOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    doubts: number
    answers: number
    raisedComplaints: number
    assignedComplaints: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    doubts?: boolean | UserCountOutputTypeCountDoubtsArgs
    answers?: boolean | UserCountOutputTypeCountAnswersArgs
    raisedComplaints?: boolean | UserCountOutputTypeCountRaisedComplaintsArgs
    assignedComplaints?: boolean | UserCountOutputTypeCountAssignedComplaintsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountDoubtsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DoubtWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAnswersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AnswerWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountRaisedComplaintsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ComplaintWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAssignedComplaintsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ComplaintWhereInput
  }


  /**
   * Count Type DoubtCountOutputType
   */

  export type DoubtCountOutputType = {
    answers: number
  }

  export type DoubtCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    answers?: boolean | DoubtCountOutputTypeCountAnswersArgs
  }

  // Custom InputTypes
  /**
   * DoubtCountOutputType without action
   */
  export type DoubtCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DoubtCountOutputType
     */
    select?: DoubtCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DoubtCountOutputType without action
   */
  export type DoubtCountOutputTypeCountAnswersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AnswerWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    password: string | null
    username: string | null
    role: $Enums.Role | null
    approvalStatus: $Enums.ApprovalStatus | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    password: string | null
    username: string | null
    role: $Enums.Role | null
    approvalStatus: $Enums.ApprovalStatus | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    name: number
    email: number
    password: number
    username: number
    role: number
    approvalStatus: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    username?: true
    role?: true
    approvalStatus?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    username?: true
    role?: true
    approvalStatus?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    username?: true
    role?: true
    approvalStatus?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    approvalStatus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    studentProfile?: boolean | User$studentProfileArgs<ExtArgs>
    facultyProfile?: boolean | User$facultyProfileArgs<ExtArgs>
    adminProfile?: boolean | User$adminProfileArgs<ExtArgs>
    doubts?: boolean | User$doubtsArgs<ExtArgs>
    answers?: boolean | User$answersArgs<ExtArgs>
    raisedComplaints?: boolean | User$raisedComplaintsArgs<ExtArgs>
    assignedComplaints?: boolean | User$assignedComplaintsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    approvalStatus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    approvalStatus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    username?: boolean
    role?: boolean
    approvalStatus?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "email" | "password" | "username" | "role" | "approvalStatus" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    studentProfile?: boolean | User$studentProfileArgs<ExtArgs>
    facultyProfile?: boolean | User$facultyProfileArgs<ExtArgs>
    adminProfile?: boolean | User$adminProfileArgs<ExtArgs>
    doubts?: boolean | User$doubtsArgs<ExtArgs>
    answers?: boolean | User$answersArgs<ExtArgs>
    raisedComplaints?: boolean | User$raisedComplaintsArgs<ExtArgs>
    assignedComplaints?: boolean | User$assignedComplaintsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      studentProfile: Prisma.$StudentProfilePayload<ExtArgs> | null
      facultyProfile: Prisma.$FacultyProfilePayload<ExtArgs> | null
      adminProfile: Prisma.$AdminProfilePayload<ExtArgs> | null
      doubts: Prisma.$DoubtPayload<ExtArgs>[]
      answers: Prisma.$AnswerPayload<ExtArgs>[]
      raisedComplaints: Prisma.$ComplaintPayload<ExtArgs>[]
      assignedComplaints: Prisma.$ComplaintPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      email: string
      password: string
      username: string
      role: $Enums.Role
      approvalStatus: $Enums.ApprovalStatus
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    studentProfile<T extends User$studentProfileArgs<ExtArgs> = {}>(args?: Subset<T, User$studentProfileArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    facultyProfile<T extends User$facultyProfileArgs<ExtArgs> = {}>(args?: Subset<T, User$facultyProfileArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    adminProfile<T extends User$adminProfileArgs<ExtArgs> = {}>(args?: Subset<T, User$adminProfileArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    doubts<T extends User$doubtsArgs<ExtArgs> = {}>(args?: Subset<T, User$doubtsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    answers<T extends User$answersArgs<ExtArgs> = {}>(args?: Subset<T, User$answersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    raisedComplaints<T extends User$raisedComplaintsArgs<ExtArgs> = {}>(args?: Subset<T, User$raisedComplaintsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    assignedComplaints<T extends User$assignedComplaintsArgs<ExtArgs> = {}>(args?: Subset<T, User$assignedComplaintsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly username: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'Role'>
    readonly approvalStatus: FieldRef<"User", 'ApprovalStatus'>
    readonly isActive: FieldRef<"User", 'Boolean'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.studentProfile
   */
  export type User$studentProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    where?: StudentProfileWhereInput
  }

  /**
   * User.facultyProfile
   */
  export type User$facultyProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    where?: FacultyProfileWhereInput
  }

  /**
   * User.adminProfile
   */
  export type User$adminProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    where?: AdminProfileWhereInput
  }

  /**
   * User.doubts
   */
  export type User$doubtsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    where?: DoubtWhereInput
    orderBy?: DoubtOrderByWithRelationInput | DoubtOrderByWithRelationInput[]
    cursor?: DoubtWhereUniqueInput
    take?: number
    skip?: number
    distinct?: DoubtScalarFieldEnum | DoubtScalarFieldEnum[]
  }

  /**
   * User.answers
   */
  export type User$answersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    where?: AnswerWhereInput
    orderBy?: AnswerOrderByWithRelationInput | AnswerOrderByWithRelationInput[]
    cursor?: AnswerWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AnswerScalarFieldEnum | AnswerScalarFieldEnum[]
  }

  /**
   * User.raisedComplaints
   */
  export type User$raisedComplaintsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    where?: ComplaintWhereInput
    orderBy?: ComplaintOrderByWithRelationInput | ComplaintOrderByWithRelationInput[]
    cursor?: ComplaintWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ComplaintScalarFieldEnum | ComplaintScalarFieldEnum[]
  }

  /**
   * User.assignedComplaints
   */
  export type User$assignedComplaintsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    where?: ComplaintWhereInput
    orderBy?: ComplaintOrderByWithRelationInput | ComplaintOrderByWithRelationInput[]
    cursor?: ComplaintWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ComplaintScalarFieldEnum | ComplaintScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model StudentProfile
   */

  export type AggregateStudentProfile = {
    _count: StudentProfileCountAggregateOutputType | null
    _avg: StudentProfileAvgAggregateOutputType | null
    _sum: StudentProfileSumAggregateOutputType | null
    _min: StudentProfileMinAggregateOutputType | null
    _max: StudentProfileMaxAggregateOutputType | null
  }

  export type StudentProfileAvgAggregateOutputType = {
    semester: number | null
    phoneNumber: number | null
    doubtsAsked: number | null
    doubtsSolved: number | null
  }

  export type StudentProfileSumAggregateOutputType = {
    semester: number | null
    phoneNumber: number | null
    doubtsAsked: number | null
    doubtsSolved: number | null
  }

  export type StudentProfileMinAggregateOutputType = {
    id: string | null
    userId: string | null
    enrollmentNumber: string | null
    department: string | null
    branch: string | null
    semester: number | null
    phoneNumber: number | null
    address: string | null
    isStudying: boolean | null
    guardianName: string | null
    guardianPhone: string | null
    doubtsAsked: number | null
    doubtsSolved: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type StudentProfileMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    enrollmentNumber: string | null
    department: string | null
    branch: string | null
    semester: number | null
    phoneNumber: number | null
    address: string | null
    isStudying: boolean | null
    guardianName: string | null
    guardianPhone: string | null
    doubtsAsked: number | null
    doubtsSolved: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type StudentProfileCountAggregateOutputType = {
    id: number
    userId: number
    enrollmentNumber: number
    department: number
    branch: number
    semester: number
    phoneNumber: number
    address: number
    isStudying: number
    guardianName: number
    guardianPhone: number
    doubtsAsked: number
    doubtsSolved: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type StudentProfileAvgAggregateInputType = {
    semester?: true
    phoneNumber?: true
    doubtsAsked?: true
    doubtsSolved?: true
  }

  export type StudentProfileSumAggregateInputType = {
    semester?: true
    phoneNumber?: true
    doubtsAsked?: true
    doubtsSolved?: true
  }

  export type StudentProfileMinAggregateInputType = {
    id?: true
    userId?: true
    enrollmentNumber?: true
    department?: true
    branch?: true
    semester?: true
    phoneNumber?: true
    address?: true
    isStudying?: true
    guardianName?: true
    guardianPhone?: true
    doubtsAsked?: true
    doubtsSolved?: true
    createdAt?: true
    updatedAt?: true
  }

  export type StudentProfileMaxAggregateInputType = {
    id?: true
    userId?: true
    enrollmentNumber?: true
    department?: true
    branch?: true
    semester?: true
    phoneNumber?: true
    address?: true
    isStudying?: true
    guardianName?: true
    guardianPhone?: true
    doubtsAsked?: true
    doubtsSolved?: true
    createdAt?: true
    updatedAt?: true
  }

  export type StudentProfileCountAggregateInputType = {
    id?: true
    userId?: true
    enrollmentNumber?: true
    department?: true
    branch?: true
    semester?: true
    phoneNumber?: true
    address?: true
    isStudying?: true
    guardianName?: true
    guardianPhone?: true
    doubtsAsked?: true
    doubtsSolved?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type StudentProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which StudentProfile to aggregate.
     */
    where?: StudentProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of StudentProfiles to fetch.
     */
    orderBy?: StudentProfileOrderByWithRelationInput | StudentProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: StudentProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` StudentProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` StudentProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned StudentProfiles
    **/
    _count?: true | StudentProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: StudentProfileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: StudentProfileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: StudentProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: StudentProfileMaxAggregateInputType
  }

  export type GetStudentProfileAggregateType<T extends StudentProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateStudentProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateStudentProfile[P]>
      : GetScalarType<T[P], AggregateStudentProfile[P]>
  }




  export type StudentProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: StudentProfileWhereInput
    orderBy?: StudentProfileOrderByWithAggregationInput | StudentProfileOrderByWithAggregationInput[]
    by: StudentProfileScalarFieldEnum[] | StudentProfileScalarFieldEnum
    having?: StudentProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: StudentProfileCountAggregateInputType | true
    _avg?: StudentProfileAvgAggregateInputType
    _sum?: StudentProfileSumAggregateInputType
    _min?: StudentProfileMinAggregateInputType
    _max?: StudentProfileMaxAggregateInputType
  }

  export type StudentProfileGroupByOutputType = {
    id: string
    userId: string
    enrollmentNumber: string
    department: string
    branch: string
    semester: number
    phoneNumber: number
    address: string
    isStudying: boolean
    guardianName: string
    guardianPhone: string
    doubtsAsked: number
    doubtsSolved: number
    createdAt: Date
    updatedAt: Date
    _count: StudentProfileCountAggregateOutputType | null
    _avg: StudentProfileAvgAggregateOutputType | null
    _sum: StudentProfileSumAggregateOutputType | null
    _min: StudentProfileMinAggregateOutputType | null
    _max: StudentProfileMaxAggregateOutputType | null
  }

  type GetStudentProfileGroupByPayload<T extends StudentProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<StudentProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof StudentProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], StudentProfileGroupByOutputType[P]>
            : GetScalarType<T[P], StudentProfileGroupByOutputType[P]>
        }
      >
    >


  export type StudentProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    enrollmentNumber?: boolean
    department?: boolean
    branch?: boolean
    semester?: boolean
    phoneNumber?: boolean
    address?: boolean
    isStudying?: boolean
    guardianName?: boolean
    guardianPhone?: boolean
    doubtsAsked?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["studentProfile"]>

  export type StudentProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    enrollmentNumber?: boolean
    department?: boolean
    branch?: boolean
    semester?: boolean
    phoneNumber?: boolean
    address?: boolean
    isStudying?: boolean
    guardianName?: boolean
    guardianPhone?: boolean
    doubtsAsked?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["studentProfile"]>

  export type StudentProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    enrollmentNumber?: boolean
    department?: boolean
    branch?: boolean
    semester?: boolean
    phoneNumber?: boolean
    address?: boolean
    isStudying?: boolean
    guardianName?: boolean
    guardianPhone?: boolean
    doubtsAsked?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["studentProfile"]>

  export type StudentProfileSelectScalar = {
    id?: boolean
    userId?: boolean
    enrollmentNumber?: boolean
    department?: boolean
    branch?: boolean
    semester?: boolean
    phoneNumber?: boolean
    address?: boolean
    isStudying?: boolean
    guardianName?: boolean
    guardianPhone?: boolean
    doubtsAsked?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type StudentProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "enrollmentNumber" | "department" | "branch" | "semester" | "phoneNumber" | "address" | "isStudying" | "guardianName" | "guardianPhone" | "doubtsAsked" | "doubtsSolved" | "createdAt" | "updatedAt", ExtArgs["result"]["studentProfile"]>
  export type StudentProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type StudentProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type StudentProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $StudentProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "StudentProfile"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      enrollmentNumber: string
      department: string
      branch: string
      semester: number
      phoneNumber: number
      address: string
      isStudying: boolean
      guardianName: string
      guardianPhone: string
      doubtsAsked: number
      doubtsSolved: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["studentProfile"]>
    composites: {}
  }

  type StudentProfileGetPayload<S extends boolean | null | undefined | StudentProfileDefaultArgs> = $Result.GetResult<Prisma.$StudentProfilePayload, S>

  type StudentProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<StudentProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: StudentProfileCountAggregateInputType | true
    }

  export interface StudentProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['StudentProfile'], meta: { name: 'StudentProfile' } }
    /**
     * Find zero or one StudentProfile that matches the filter.
     * @param {StudentProfileFindUniqueArgs} args - Arguments to find a StudentProfile
     * @example
     * // Get one StudentProfile
     * const studentProfile = await prisma.studentProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends StudentProfileFindUniqueArgs>(args: SelectSubset<T, StudentProfileFindUniqueArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one StudentProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {StudentProfileFindUniqueOrThrowArgs} args - Arguments to find a StudentProfile
     * @example
     * // Get one StudentProfile
     * const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends StudentProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, StudentProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first StudentProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileFindFirstArgs} args - Arguments to find a StudentProfile
     * @example
     * // Get one StudentProfile
     * const studentProfile = await prisma.studentProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends StudentProfileFindFirstArgs>(args?: SelectSubset<T, StudentProfileFindFirstArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first StudentProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileFindFirstOrThrowArgs} args - Arguments to find a StudentProfile
     * @example
     * // Get one StudentProfile
     * const studentProfile = await prisma.studentProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends StudentProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, StudentProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more StudentProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all StudentProfiles
     * const studentProfiles = await prisma.studentProfile.findMany()
     * 
     * // Get first 10 StudentProfiles
     * const studentProfiles = await prisma.studentProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const studentProfileWithIdOnly = await prisma.studentProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends StudentProfileFindManyArgs>(args?: SelectSubset<T, StudentProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a StudentProfile.
     * @param {StudentProfileCreateArgs} args - Arguments to create a StudentProfile.
     * @example
     * // Create one StudentProfile
     * const StudentProfile = await prisma.studentProfile.create({
     *   data: {
     *     // ... data to create a StudentProfile
     *   }
     * })
     * 
     */
    create<T extends StudentProfileCreateArgs>(args: SelectSubset<T, StudentProfileCreateArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many StudentProfiles.
     * @param {StudentProfileCreateManyArgs} args - Arguments to create many StudentProfiles.
     * @example
     * // Create many StudentProfiles
     * const studentProfile = await prisma.studentProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends StudentProfileCreateManyArgs>(args?: SelectSubset<T, StudentProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many StudentProfiles and returns the data saved in the database.
     * @param {StudentProfileCreateManyAndReturnArgs} args - Arguments to create many StudentProfiles.
     * @example
     * // Create many StudentProfiles
     * const studentProfile = await prisma.studentProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many StudentProfiles and only return the `id`
     * const studentProfileWithIdOnly = await prisma.studentProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends StudentProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, StudentProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a StudentProfile.
     * @param {StudentProfileDeleteArgs} args - Arguments to delete one StudentProfile.
     * @example
     * // Delete one StudentProfile
     * const StudentProfile = await prisma.studentProfile.delete({
     *   where: {
     *     // ... filter to delete one StudentProfile
     *   }
     * })
     * 
     */
    delete<T extends StudentProfileDeleteArgs>(args: SelectSubset<T, StudentProfileDeleteArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one StudentProfile.
     * @param {StudentProfileUpdateArgs} args - Arguments to update one StudentProfile.
     * @example
     * // Update one StudentProfile
     * const studentProfile = await prisma.studentProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends StudentProfileUpdateArgs>(args: SelectSubset<T, StudentProfileUpdateArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more StudentProfiles.
     * @param {StudentProfileDeleteManyArgs} args - Arguments to filter StudentProfiles to delete.
     * @example
     * // Delete a few StudentProfiles
     * const { count } = await prisma.studentProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends StudentProfileDeleteManyArgs>(args?: SelectSubset<T, StudentProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more StudentProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many StudentProfiles
     * const studentProfile = await prisma.studentProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends StudentProfileUpdateManyArgs>(args: SelectSubset<T, StudentProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more StudentProfiles and returns the data updated in the database.
     * @param {StudentProfileUpdateManyAndReturnArgs} args - Arguments to update many StudentProfiles.
     * @example
     * // Update many StudentProfiles
     * const studentProfile = await prisma.studentProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more StudentProfiles and only return the `id`
     * const studentProfileWithIdOnly = await prisma.studentProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends StudentProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, StudentProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one StudentProfile.
     * @param {StudentProfileUpsertArgs} args - Arguments to update or create a StudentProfile.
     * @example
     * // Update or create a StudentProfile
     * const studentProfile = await prisma.studentProfile.upsert({
     *   create: {
     *     // ... data to create a StudentProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the StudentProfile we want to update
     *   }
     * })
     */
    upsert<T extends StudentProfileUpsertArgs>(args: SelectSubset<T, StudentProfileUpsertArgs<ExtArgs>>): Prisma__StudentProfileClient<$Result.GetResult<Prisma.$StudentProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of StudentProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileCountArgs} args - Arguments to filter StudentProfiles to count.
     * @example
     * // Count the number of StudentProfiles
     * const count = await prisma.studentProfile.count({
     *   where: {
     *     // ... the filter for the StudentProfiles we want to count
     *   }
     * })
    **/
    count<T extends StudentProfileCountArgs>(
      args?: Subset<T, StudentProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], StudentProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a StudentProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends StudentProfileAggregateArgs>(args: Subset<T, StudentProfileAggregateArgs>): Prisma.PrismaPromise<GetStudentProfileAggregateType<T>>

    /**
     * Group by StudentProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StudentProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends StudentProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: StudentProfileGroupByArgs['orderBy'] }
        : { orderBy?: StudentProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, StudentProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetStudentProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the StudentProfile model
   */
  readonly fields: StudentProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for StudentProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__StudentProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the StudentProfile model
   */
  interface StudentProfileFieldRefs {
    readonly id: FieldRef<"StudentProfile", 'String'>
    readonly userId: FieldRef<"StudentProfile", 'String'>
    readonly enrollmentNumber: FieldRef<"StudentProfile", 'String'>
    readonly department: FieldRef<"StudentProfile", 'String'>
    readonly branch: FieldRef<"StudentProfile", 'String'>
    readonly semester: FieldRef<"StudentProfile", 'Int'>
    readonly phoneNumber: FieldRef<"StudentProfile", 'Int'>
    readonly address: FieldRef<"StudentProfile", 'String'>
    readonly isStudying: FieldRef<"StudentProfile", 'Boolean'>
    readonly guardianName: FieldRef<"StudentProfile", 'String'>
    readonly guardianPhone: FieldRef<"StudentProfile", 'String'>
    readonly doubtsAsked: FieldRef<"StudentProfile", 'Int'>
    readonly doubtsSolved: FieldRef<"StudentProfile", 'Int'>
    readonly createdAt: FieldRef<"StudentProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"StudentProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * StudentProfile findUnique
   */
  export type StudentProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * Filter, which StudentProfile to fetch.
     */
    where: StudentProfileWhereUniqueInput
  }

  /**
   * StudentProfile findUniqueOrThrow
   */
  export type StudentProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * Filter, which StudentProfile to fetch.
     */
    where: StudentProfileWhereUniqueInput
  }

  /**
   * StudentProfile findFirst
   */
  export type StudentProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * Filter, which StudentProfile to fetch.
     */
    where?: StudentProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of StudentProfiles to fetch.
     */
    orderBy?: StudentProfileOrderByWithRelationInput | StudentProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for StudentProfiles.
     */
    cursor?: StudentProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` StudentProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` StudentProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of StudentProfiles.
     */
    distinct?: StudentProfileScalarFieldEnum | StudentProfileScalarFieldEnum[]
  }

  /**
   * StudentProfile findFirstOrThrow
   */
  export type StudentProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * Filter, which StudentProfile to fetch.
     */
    where?: StudentProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of StudentProfiles to fetch.
     */
    orderBy?: StudentProfileOrderByWithRelationInput | StudentProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for StudentProfiles.
     */
    cursor?: StudentProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` StudentProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` StudentProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of StudentProfiles.
     */
    distinct?: StudentProfileScalarFieldEnum | StudentProfileScalarFieldEnum[]
  }

  /**
   * StudentProfile findMany
   */
  export type StudentProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * Filter, which StudentProfiles to fetch.
     */
    where?: StudentProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of StudentProfiles to fetch.
     */
    orderBy?: StudentProfileOrderByWithRelationInput | StudentProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing StudentProfiles.
     */
    cursor?: StudentProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` StudentProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` StudentProfiles.
     */
    skip?: number
    distinct?: StudentProfileScalarFieldEnum | StudentProfileScalarFieldEnum[]
  }

  /**
   * StudentProfile create
   */
  export type StudentProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a StudentProfile.
     */
    data: XOR<StudentProfileCreateInput, StudentProfileUncheckedCreateInput>
  }

  /**
   * StudentProfile createMany
   */
  export type StudentProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many StudentProfiles.
     */
    data: StudentProfileCreateManyInput | StudentProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * StudentProfile createManyAndReturn
   */
  export type StudentProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * The data used to create many StudentProfiles.
     */
    data: StudentProfileCreateManyInput | StudentProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * StudentProfile update
   */
  export type StudentProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a StudentProfile.
     */
    data: XOR<StudentProfileUpdateInput, StudentProfileUncheckedUpdateInput>
    /**
     * Choose, which StudentProfile to update.
     */
    where: StudentProfileWhereUniqueInput
  }

  /**
   * StudentProfile updateMany
   */
  export type StudentProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update StudentProfiles.
     */
    data: XOR<StudentProfileUpdateManyMutationInput, StudentProfileUncheckedUpdateManyInput>
    /**
     * Filter which StudentProfiles to update
     */
    where?: StudentProfileWhereInput
    /**
     * Limit how many StudentProfiles to update.
     */
    limit?: number
  }

  /**
   * StudentProfile updateManyAndReturn
   */
  export type StudentProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * The data used to update StudentProfiles.
     */
    data: XOR<StudentProfileUpdateManyMutationInput, StudentProfileUncheckedUpdateManyInput>
    /**
     * Filter which StudentProfiles to update
     */
    where?: StudentProfileWhereInput
    /**
     * Limit how many StudentProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * StudentProfile upsert
   */
  export type StudentProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the StudentProfile to update in case it exists.
     */
    where: StudentProfileWhereUniqueInput
    /**
     * In case the StudentProfile found by the `where` argument doesn't exist, create a new StudentProfile with this data.
     */
    create: XOR<StudentProfileCreateInput, StudentProfileUncheckedCreateInput>
    /**
     * In case the StudentProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<StudentProfileUpdateInput, StudentProfileUncheckedUpdateInput>
  }

  /**
   * StudentProfile delete
   */
  export type StudentProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
    /**
     * Filter which StudentProfile to delete.
     */
    where: StudentProfileWhereUniqueInput
  }

  /**
   * StudentProfile deleteMany
   */
  export type StudentProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which StudentProfiles to delete
     */
    where?: StudentProfileWhereInput
    /**
     * Limit how many StudentProfiles to delete.
     */
    limit?: number
  }

  /**
   * StudentProfile without action
   */
  export type StudentProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StudentProfile
     */
    select?: StudentProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the StudentProfile
     */
    omit?: StudentProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StudentProfileInclude<ExtArgs> | null
  }


  /**
   * Model FacultyProfile
   */

  export type AggregateFacultyProfile = {
    _count: FacultyProfileCountAggregateOutputType | null
    _avg: FacultyProfileAvgAggregateOutputType | null
    _sum: FacultyProfileSumAggregateOutputType | null
    _min: FacultyProfileMinAggregateOutputType | null
    _max: FacultyProfileMaxAggregateOutputType | null
  }

  export type FacultyProfileAvgAggregateOutputType = {
    doubtsSolved: number | null
  }

  export type FacultyProfileSumAggregateOutputType = {
    doubtsSolved: number | null
  }

  export type FacultyProfileMinAggregateOutputType = {
    id: string | null
    userId: string | null
    department: string | null
    branch: string | null
    phoneNumber: string | null
    address: string | null
    isTeaching: boolean | null
    doubtsSolved: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type FacultyProfileMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    department: string | null
    branch: string | null
    phoneNumber: string | null
    address: string | null
    isTeaching: boolean | null
    doubtsSolved: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type FacultyProfileCountAggregateOutputType = {
    id: number
    userId: number
    department: number
    branch: number
    phoneNumber: number
    address: number
    isTeaching: number
    subjects: number
    doubtsSolved: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type FacultyProfileAvgAggregateInputType = {
    doubtsSolved?: true
  }

  export type FacultyProfileSumAggregateInputType = {
    doubtsSolved?: true
  }

  export type FacultyProfileMinAggregateInputType = {
    id?: true
    userId?: true
    department?: true
    branch?: true
    phoneNumber?: true
    address?: true
    isTeaching?: true
    doubtsSolved?: true
    createdAt?: true
    updatedAt?: true
  }

  export type FacultyProfileMaxAggregateInputType = {
    id?: true
    userId?: true
    department?: true
    branch?: true
    phoneNumber?: true
    address?: true
    isTeaching?: true
    doubtsSolved?: true
    createdAt?: true
    updatedAt?: true
  }

  export type FacultyProfileCountAggregateInputType = {
    id?: true
    userId?: true
    department?: true
    branch?: true
    phoneNumber?: true
    address?: true
    isTeaching?: true
    subjects?: true
    doubtsSolved?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type FacultyProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FacultyProfile to aggregate.
     */
    where?: FacultyProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FacultyProfiles to fetch.
     */
    orderBy?: FacultyProfileOrderByWithRelationInput | FacultyProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FacultyProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FacultyProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FacultyProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned FacultyProfiles
    **/
    _count?: true | FacultyProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: FacultyProfileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: FacultyProfileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FacultyProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FacultyProfileMaxAggregateInputType
  }

  export type GetFacultyProfileAggregateType<T extends FacultyProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateFacultyProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFacultyProfile[P]>
      : GetScalarType<T[P], AggregateFacultyProfile[P]>
  }




  export type FacultyProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FacultyProfileWhereInput
    orderBy?: FacultyProfileOrderByWithAggregationInput | FacultyProfileOrderByWithAggregationInput[]
    by: FacultyProfileScalarFieldEnum[] | FacultyProfileScalarFieldEnum
    having?: FacultyProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FacultyProfileCountAggregateInputType | true
    _avg?: FacultyProfileAvgAggregateInputType
    _sum?: FacultyProfileSumAggregateInputType
    _min?: FacultyProfileMinAggregateInputType
    _max?: FacultyProfileMaxAggregateInputType
  }

  export type FacultyProfileGroupByOutputType = {
    id: string
    userId: string
    department: string
    branch: string
    phoneNumber: string
    address: string
    isTeaching: boolean
    subjects: string[]
    doubtsSolved: number
    createdAt: Date
    updatedAt: Date
    _count: FacultyProfileCountAggregateOutputType | null
    _avg: FacultyProfileAvgAggregateOutputType | null
    _sum: FacultyProfileSumAggregateOutputType | null
    _min: FacultyProfileMinAggregateOutputType | null
    _max: FacultyProfileMaxAggregateOutputType | null
  }

  type GetFacultyProfileGroupByPayload<T extends FacultyProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FacultyProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FacultyProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FacultyProfileGroupByOutputType[P]>
            : GetScalarType<T[P], FacultyProfileGroupByOutputType[P]>
        }
      >
    >


  export type FacultyProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    department?: boolean
    branch?: boolean
    phoneNumber?: boolean
    address?: boolean
    isTeaching?: boolean
    subjects?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["facultyProfile"]>

  export type FacultyProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    department?: boolean
    branch?: boolean
    phoneNumber?: boolean
    address?: boolean
    isTeaching?: boolean
    subjects?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["facultyProfile"]>

  export type FacultyProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    department?: boolean
    branch?: boolean
    phoneNumber?: boolean
    address?: boolean
    isTeaching?: boolean
    subjects?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["facultyProfile"]>

  export type FacultyProfileSelectScalar = {
    id?: boolean
    userId?: boolean
    department?: boolean
    branch?: boolean
    phoneNumber?: boolean
    address?: boolean
    isTeaching?: boolean
    subjects?: boolean
    doubtsSolved?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type FacultyProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "department" | "branch" | "phoneNumber" | "address" | "isTeaching" | "subjects" | "doubtsSolved" | "createdAt" | "updatedAt", ExtArgs["result"]["facultyProfile"]>
  export type FacultyProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type FacultyProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type FacultyProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $FacultyProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "FacultyProfile"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      department: string
      branch: string
      phoneNumber: string
      address: string
      isTeaching: boolean
      subjects: string[]
      doubtsSolved: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["facultyProfile"]>
    composites: {}
  }

  type FacultyProfileGetPayload<S extends boolean | null | undefined | FacultyProfileDefaultArgs> = $Result.GetResult<Prisma.$FacultyProfilePayload, S>

  type FacultyProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<FacultyProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: FacultyProfileCountAggregateInputType | true
    }

  export interface FacultyProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['FacultyProfile'], meta: { name: 'FacultyProfile' } }
    /**
     * Find zero or one FacultyProfile that matches the filter.
     * @param {FacultyProfileFindUniqueArgs} args - Arguments to find a FacultyProfile
     * @example
     * // Get one FacultyProfile
     * const facultyProfile = await prisma.facultyProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FacultyProfileFindUniqueArgs>(args: SelectSubset<T, FacultyProfileFindUniqueArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one FacultyProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {FacultyProfileFindUniqueOrThrowArgs} args - Arguments to find a FacultyProfile
     * @example
     * // Get one FacultyProfile
     * const facultyProfile = await prisma.facultyProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FacultyProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, FacultyProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first FacultyProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileFindFirstArgs} args - Arguments to find a FacultyProfile
     * @example
     * // Get one FacultyProfile
     * const facultyProfile = await prisma.facultyProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FacultyProfileFindFirstArgs>(args?: SelectSubset<T, FacultyProfileFindFirstArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first FacultyProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileFindFirstOrThrowArgs} args - Arguments to find a FacultyProfile
     * @example
     * // Get one FacultyProfile
     * const facultyProfile = await prisma.facultyProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FacultyProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, FacultyProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more FacultyProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FacultyProfiles
     * const facultyProfiles = await prisma.facultyProfile.findMany()
     * 
     * // Get first 10 FacultyProfiles
     * const facultyProfiles = await prisma.facultyProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const facultyProfileWithIdOnly = await prisma.facultyProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends FacultyProfileFindManyArgs>(args?: SelectSubset<T, FacultyProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a FacultyProfile.
     * @param {FacultyProfileCreateArgs} args - Arguments to create a FacultyProfile.
     * @example
     * // Create one FacultyProfile
     * const FacultyProfile = await prisma.facultyProfile.create({
     *   data: {
     *     // ... data to create a FacultyProfile
     *   }
     * })
     * 
     */
    create<T extends FacultyProfileCreateArgs>(args: SelectSubset<T, FacultyProfileCreateArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many FacultyProfiles.
     * @param {FacultyProfileCreateManyArgs} args - Arguments to create many FacultyProfiles.
     * @example
     * // Create many FacultyProfiles
     * const facultyProfile = await prisma.facultyProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FacultyProfileCreateManyArgs>(args?: SelectSubset<T, FacultyProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many FacultyProfiles and returns the data saved in the database.
     * @param {FacultyProfileCreateManyAndReturnArgs} args - Arguments to create many FacultyProfiles.
     * @example
     * // Create many FacultyProfiles
     * const facultyProfile = await prisma.facultyProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many FacultyProfiles and only return the `id`
     * const facultyProfileWithIdOnly = await prisma.facultyProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FacultyProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, FacultyProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a FacultyProfile.
     * @param {FacultyProfileDeleteArgs} args - Arguments to delete one FacultyProfile.
     * @example
     * // Delete one FacultyProfile
     * const FacultyProfile = await prisma.facultyProfile.delete({
     *   where: {
     *     // ... filter to delete one FacultyProfile
     *   }
     * })
     * 
     */
    delete<T extends FacultyProfileDeleteArgs>(args: SelectSubset<T, FacultyProfileDeleteArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one FacultyProfile.
     * @param {FacultyProfileUpdateArgs} args - Arguments to update one FacultyProfile.
     * @example
     * // Update one FacultyProfile
     * const facultyProfile = await prisma.facultyProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FacultyProfileUpdateArgs>(args: SelectSubset<T, FacultyProfileUpdateArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more FacultyProfiles.
     * @param {FacultyProfileDeleteManyArgs} args - Arguments to filter FacultyProfiles to delete.
     * @example
     * // Delete a few FacultyProfiles
     * const { count } = await prisma.facultyProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FacultyProfileDeleteManyArgs>(args?: SelectSubset<T, FacultyProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FacultyProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FacultyProfiles
     * const facultyProfile = await prisma.facultyProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FacultyProfileUpdateManyArgs>(args: SelectSubset<T, FacultyProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FacultyProfiles and returns the data updated in the database.
     * @param {FacultyProfileUpdateManyAndReturnArgs} args - Arguments to update many FacultyProfiles.
     * @example
     * // Update many FacultyProfiles
     * const facultyProfile = await prisma.facultyProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more FacultyProfiles and only return the `id`
     * const facultyProfileWithIdOnly = await prisma.facultyProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends FacultyProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, FacultyProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one FacultyProfile.
     * @param {FacultyProfileUpsertArgs} args - Arguments to update or create a FacultyProfile.
     * @example
     * // Update or create a FacultyProfile
     * const facultyProfile = await prisma.facultyProfile.upsert({
     *   create: {
     *     // ... data to create a FacultyProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FacultyProfile we want to update
     *   }
     * })
     */
    upsert<T extends FacultyProfileUpsertArgs>(args: SelectSubset<T, FacultyProfileUpsertArgs<ExtArgs>>): Prisma__FacultyProfileClient<$Result.GetResult<Prisma.$FacultyProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of FacultyProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileCountArgs} args - Arguments to filter FacultyProfiles to count.
     * @example
     * // Count the number of FacultyProfiles
     * const count = await prisma.facultyProfile.count({
     *   where: {
     *     // ... the filter for the FacultyProfiles we want to count
     *   }
     * })
    **/
    count<T extends FacultyProfileCountArgs>(
      args?: Subset<T, FacultyProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FacultyProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a FacultyProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends FacultyProfileAggregateArgs>(args: Subset<T, FacultyProfileAggregateArgs>): Prisma.PrismaPromise<GetFacultyProfileAggregateType<T>>

    /**
     * Group by FacultyProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FacultyProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends FacultyProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FacultyProfileGroupByArgs['orderBy'] }
        : { orderBy?: FacultyProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, FacultyProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFacultyProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the FacultyProfile model
   */
  readonly fields: FacultyProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FacultyProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FacultyProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the FacultyProfile model
   */
  interface FacultyProfileFieldRefs {
    readonly id: FieldRef<"FacultyProfile", 'String'>
    readonly userId: FieldRef<"FacultyProfile", 'String'>
    readonly department: FieldRef<"FacultyProfile", 'String'>
    readonly branch: FieldRef<"FacultyProfile", 'String'>
    readonly phoneNumber: FieldRef<"FacultyProfile", 'String'>
    readonly address: FieldRef<"FacultyProfile", 'String'>
    readonly isTeaching: FieldRef<"FacultyProfile", 'Boolean'>
    readonly subjects: FieldRef<"FacultyProfile", 'String[]'>
    readonly doubtsSolved: FieldRef<"FacultyProfile", 'Int'>
    readonly createdAt: FieldRef<"FacultyProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"FacultyProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * FacultyProfile findUnique
   */
  export type FacultyProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * Filter, which FacultyProfile to fetch.
     */
    where: FacultyProfileWhereUniqueInput
  }

  /**
   * FacultyProfile findUniqueOrThrow
   */
  export type FacultyProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * Filter, which FacultyProfile to fetch.
     */
    where: FacultyProfileWhereUniqueInput
  }

  /**
   * FacultyProfile findFirst
   */
  export type FacultyProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * Filter, which FacultyProfile to fetch.
     */
    where?: FacultyProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FacultyProfiles to fetch.
     */
    orderBy?: FacultyProfileOrderByWithRelationInput | FacultyProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FacultyProfiles.
     */
    cursor?: FacultyProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FacultyProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FacultyProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FacultyProfiles.
     */
    distinct?: FacultyProfileScalarFieldEnum | FacultyProfileScalarFieldEnum[]
  }

  /**
   * FacultyProfile findFirstOrThrow
   */
  export type FacultyProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * Filter, which FacultyProfile to fetch.
     */
    where?: FacultyProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FacultyProfiles to fetch.
     */
    orderBy?: FacultyProfileOrderByWithRelationInput | FacultyProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FacultyProfiles.
     */
    cursor?: FacultyProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FacultyProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FacultyProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FacultyProfiles.
     */
    distinct?: FacultyProfileScalarFieldEnum | FacultyProfileScalarFieldEnum[]
  }

  /**
   * FacultyProfile findMany
   */
  export type FacultyProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * Filter, which FacultyProfiles to fetch.
     */
    where?: FacultyProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FacultyProfiles to fetch.
     */
    orderBy?: FacultyProfileOrderByWithRelationInput | FacultyProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing FacultyProfiles.
     */
    cursor?: FacultyProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FacultyProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FacultyProfiles.
     */
    skip?: number
    distinct?: FacultyProfileScalarFieldEnum | FacultyProfileScalarFieldEnum[]
  }

  /**
   * FacultyProfile create
   */
  export type FacultyProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a FacultyProfile.
     */
    data: XOR<FacultyProfileCreateInput, FacultyProfileUncheckedCreateInput>
  }

  /**
   * FacultyProfile createMany
   */
  export type FacultyProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many FacultyProfiles.
     */
    data: FacultyProfileCreateManyInput | FacultyProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * FacultyProfile createManyAndReturn
   */
  export type FacultyProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * The data used to create many FacultyProfiles.
     */
    data: FacultyProfileCreateManyInput | FacultyProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * FacultyProfile update
   */
  export type FacultyProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a FacultyProfile.
     */
    data: XOR<FacultyProfileUpdateInput, FacultyProfileUncheckedUpdateInput>
    /**
     * Choose, which FacultyProfile to update.
     */
    where: FacultyProfileWhereUniqueInput
  }

  /**
   * FacultyProfile updateMany
   */
  export type FacultyProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update FacultyProfiles.
     */
    data: XOR<FacultyProfileUpdateManyMutationInput, FacultyProfileUncheckedUpdateManyInput>
    /**
     * Filter which FacultyProfiles to update
     */
    where?: FacultyProfileWhereInput
    /**
     * Limit how many FacultyProfiles to update.
     */
    limit?: number
  }

  /**
   * FacultyProfile updateManyAndReturn
   */
  export type FacultyProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * The data used to update FacultyProfiles.
     */
    data: XOR<FacultyProfileUpdateManyMutationInput, FacultyProfileUncheckedUpdateManyInput>
    /**
     * Filter which FacultyProfiles to update
     */
    where?: FacultyProfileWhereInput
    /**
     * Limit how many FacultyProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * FacultyProfile upsert
   */
  export type FacultyProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the FacultyProfile to update in case it exists.
     */
    where: FacultyProfileWhereUniqueInput
    /**
     * In case the FacultyProfile found by the `where` argument doesn't exist, create a new FacultyProfile with this data.
     */
    create: XOR<FacultyProfileCreateInput, FacultyProfileUncheckedCreateInput>
    /**
     * In case the FacultyProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FacultyProfileUpdateInput, FacultyProfileUncheckedUpdateInput>
  }

  /**
   * FacultyProfile delete
   */
  export type FacultyProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
    /**
     * Filter which FacultyProfile to delete.
     */
    where: FacultyProfileWhereUniqueInput
  }

  /**
   * FacultyProfile deleteMany
   */
  export type FacultyProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FacultyProfiles to delete
     */
    where?: FacultyProfileWhereInput
    /**
     * Limit how many FacultyProfiles to delete.
     */
    limit?: number
  }

  /**
   * FacultyProfile without action
   */
  export type FacultyProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FacultyProfile
     */
    select?: FacultyProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FacultyProfile
     */
    omit?: FacultyProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FacultyProfileInclude<ExtArgs> | null
  }


  /**
   * Model AdminProfile
   */

  export type AggregateAdminProfile = {
    _count: AdminProfileCountAggregateOutputType | null
    _avg: AdminProfileAvgAggregateOutputType | null
    _sum: AdminProfileSumAggregateOutputType | null
    _min: AdminProfileMinAggregateOutputType | null
    _max: AdminProfileMaxAggregateOutputType | null
  }

  export type AdminProfileAvgAggregateOutputType = {
    complaintsAssigned: number | null
    complaintsClosed: number | null
    usersManaged: number | null
  }

  export type AdminProfileSumAggregateOutputType = {
    complaintsAssigned: number | null
    complaintsClosed: number | null
    usersManaged: number | null
  }

  export type AdminProfileMinAggregateOutputType = {
    id: string | null
    userId: string | null
    adminLevel: $Enums.AdminLevel | null
    manageUsers: boolean | null
    manageComplaints: boolean | null
    manageDoubts: boolean | null
    viewAnalytics: boolean | null
    complaintsAssigned: number | null
    complaintsClosed: number | null
    usersManaged: number | null
    lastLoginAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AdminProfileMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    adminLevel: $Enums.AdminLevel | null
    manageUsers: boolean | null
    manageComplaints: boolean | null
    manageDoubts: boolean | null
    viewAnalytics: boolean | null
    complaintsAssigned: number | null
    complaintsClosed: number | null
    usersManaged: number | null
    lastLoginAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AdminProfileCountAggregateOutputType = {
    id: number
    userId: number
    adminLevel: number
    manageUsers: number
    manageComplaints: number
    manageDoubts: number
    viewAnalytics: number
    assignedDepartments: number
    allowedCategories: number
    complaintsAssigned: number
    complaintsClosed: number
    usersManaged: number
    lastLoginAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AdminProfileAvgAggregateInputType = {
    complaintsAssigned?: true
    complaintsClosed?: true
    usersManaged?: true
  }

  export type AdminProfileSumAggregateInputType = {
    complaintsAssigned?: true
    complaintsClosed?: true
    usersManaged?: true
  }

  export type AdminProfileMinAggregateInputType = {
    id?: true
    userId?: true
    adminLevel?: true
    manageUsers?: true
    manageComplaints?: true
    manageDoubts?: true
    viewAnalytics?: true
    complaintsAssigned?: true
    complaintsClosed?: true
    usersManaged?: true
    lastLoginAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AdminProfileMaxAggregateInputType = {
    id?: true
    userId?: true
    adminLevel?: true
    manageUsers?: true
    manageComplaints?: true
    manageDoubts?: true
    viewAnalytics?: true
    complaintsAssigned?: true
    complaintsClosed?: true
    usersManaged?: true
    lastLoginAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AdminProfileCountAggregateInputType = {
    id?: true
    userId?: true
    adminLevel?: true
    manageUsers?: true
    manageComplaints?: true
    manageDoubts?: true
    viewAnalytics?: true
    assignedDepartments?: true
    allowedCategories?: true
    complaintsAssigned?: true
    complaintsClosed?: true
    usersManaged?: true
    lastLoginAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AdminProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminProfile to aggregate.
     */
    where?: AdminProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminProfiles to fetch.
     */
    orderBy?: AdminProfileOrderByWithRelationInput | AdminProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AdminProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AdminProfiles
    **/
    _count?: true | AdminProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AdminProfileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AdminProfileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AdminProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AdminProfileMaxAggregateInputType
  }

  export type GetAdminProfileAggregateType<T extends AdminProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateAdminProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAdminProfile[P]>
      : GetScalarType<T[P], AggregateAdminProfile[P]>
  }




  export type AdminProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AdminProfileWhereInput
    orderBy?: AdminProfileOrderByWithAggregationInput | AdminProfileOrderByWithAggregationInput[]
    by: AdminProfileScalarFieldEnum[] | AdminProfileScalarFieldEnum
    having?: AdminProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AdminProfileCountAggregateInputType | true
    _avg?: AdminProfileAvgAggregateInputType
    _sum?: AdminProfileSumAggregateInputType
    _min?: AdminProfileMinAggregateInputType
    _max?: AdminProfileMaxAggregateInputType
  }

  export type AdminProfileGroupByOutputType = {
    id: string
    userId: string
    adminLevel: $Enums.AdminLevel
    manageUsers: boolean
    manageComplaints: boolean
    manageDoubts: boolean
    viewAnalytics: boolean
    assignedDepartments: string[]
    allowedCategories: string[]
    complaintsAssigned: number
    complaintsClosed: number
    usersManaged: number
    lastLoginAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: AdminProfileCountAggregateOutputType | null
    _avg: AdminProfileAvgAggregateOutputType | null
    _sum: AdminProfileSumAggregateOutputType | null
    _min: AdminProfileMinAggregateOutputType | null
    _max: AdminProfileMaxAggregateOutputType | null
  }

  type GetAdminProfileGroupByPayload<T extends AdminProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AdminProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AdminProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AdminProfileGroupByOutputType[P]>
            : GetScalarType<T[P], AdminProfileGroupByOutputType[P]>
        }
      >
    >


  export type AdminProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    adminLevel?: boolean
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: boolean
    allowedCategories?: boolean
    complaintsAssigned?: boolean
    complaintsClosed?: boolean
    usersManaged?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminProfile"]>

  export type AdminProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    adminLevel?: boolean
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: boolean
    allowedCategories?: boolean
    complaintsAssigned?: boolean
    complaintsClosed?: boolean
    usersManaged?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminProfile"]>

  export type AdminProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    adminLevel?: boolean
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: boolean
    allowedCategories?: boolean
    complaintsAssigned?: boolean
    complaintsClosed?: boolean
    usersManaged?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["adminProfile"]>

  export type AdminProfileSelectScalar = {
    id?: boolean
    userId?: boolean
    adminLevel?: boolean
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: boolean
    allowedCategories?: boolean
    complaintsAssigned?: boolean
    complaintsClosed?: boolean
    usersManaged?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AdminProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "adminLevel" | "manageUsers" | "manageComplaints" | "manageDoubts" | "viewAnalytics" | "assignedDepartments" | "allowedCategories" | "complaintsAssigned" | "complaintsClosed" | "usersManaged" | "lastLoginAt" | "createdAt" | "updatedAt", ExtArgs["result"]["adminProfile"]>
  export type AdminProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AdminProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AdminProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $AdminProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AdminProfile"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      adminLevel: $Enums.AdminLevel
      manageUsers: boolean
      manageComplaints: boolean
      manageDoubts: boolean
      viewAnalytics: boolean
      assignedDepartments: string[]
      allowedCategories: string[]
      complaintsAssigned: number
      complaintsClosed: number
      usersManaged: number
      lastLoginAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["adminProfile"]>
    composites: {}
  }

  type AdminProfileGetPayload<S extends boolean | null | undefined | AdminProfileDefaultArgs> = $Result.GetResult<Prisma.$AdminProfilePayload, S>

  type AdminProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AdminProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AdminProfileCountAggregateInputType | true
    }

  export interface AdminProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AdminProfile'], meta: { name: 'AdminProfile' } }
    /**
     * Find zero or one AdminProfile that matches the filter.
     * @param {AdminProfileFindUniqueArgs} args - Arguments to find a AdminProfile
     * @example
     * // Get one AdminProfile
     * const adminProfile = await prisma.adminProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AdminProfileFindUniqueArgs>(args: SelectSubset<T, AdminProfileFindUniqueArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AdminProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AdminProfileFindUniqueOrThrowArgs} args - Arguments to find a AdminProfile
     * @example
     * // Get one AdminProfile
     * const adminProfile = await prisma.adminProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AdminProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, AdminProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileFindFirstArgs} args - Arguments to find a AdminProfile
     * @example
     * // Get one AdminProfile
     * const adminProfile = await prisma.adminProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AdminProfileFindFirstArgs>(args?: SelectSubset<T, AdminProfileFindFirstArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AdminProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileFindFirstOrThrowArgs} args - Arguments to find a AdminProfile
     * @example
     * // Get one AdminProfile
     * const adminProfile = await prisma.adminProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AdminProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, AdminProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AdminProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AdminProfiles
     * const adminProfiles = await prisma.adminProfile.findMany()
     * 
     * // Get first 10 AdminProfiles
     * const adminProfiles = await prisma.adminProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const adminProfileWithIdOnly = await prisma.adminProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AdminProfileFindManyArgs>(args?: SelectSubset<T, AdminProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AdminProfile.
     * @param {AdminProfileCreateArgs} args - Arguments to create a AdminProfile.
     * @example
     * // Create one AdminProfile
     * const AdminProfile = await prisma.adminProfile.create({
     *   data: {
     *     // ... data to create a AdminProfile
     *   }
     * })
     * 
     */
    create<T extends AdminProfileCreateArgs>(args: SelectSubset<T, AdminProfileCreateArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AdminProfiles.
     * @param {AdminProfileCreateManyArgs} args - Arguments to create many AdminProfiles.
     * @example
     * // Create many AdminProfiles
     * const adminProfile = await prisma.adminProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AdminProfileCreateManyArgs>(args?: SelectSubset<T, AdminProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AdminProfiles and returns the data saved in the database.
     * @param {AdminProfileCreateManyAndReturnArgs} args - Arguments to create many AdminProfiles.
     * @example
     * // Create many AdminProfiles
     * const adminProfile = await prisma.adminProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AdminProfiles and only return the `id`
     * const adminProfileWithIdOnly = await prisma.adminProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AdminProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, AdminProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AdminProfile.
     * @param {AdminProfileDeleteArgs} args - Arguments to delete one AdminProfile.
     * @example
     * // Delete one AdminProfile
     * const AdminProfile = await prisma.adminProfile.delete({
     *   where: {
     *     // ... filter to delete one AdminProfile
     *   }
     * })
     * 
     */
    delete<T extends AdminProfileDeleteArgs>(args: SelectSubset<T, AdminProfileDeleteArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AdminProfile.
     * @param {AdminProfileUpdateArgs} args - Arguments to update one AdminProfile.
     * @example
     * // Update one AdminProfile
     * const adminProfile = await prisma.adminProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AdminProfileUpdateArgs>(args: SelectSubset<T, AdminProfileUpdateArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AdminProfiles.
     * @param {AdminProfileDeleteManyArgs} args - Arguments to filter AdminProfiles to delete.
     * @example
     * // Delete a few AdminProfiles
     * const { count } = await prisma.adminProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AdminProfileDeleteManyArgs>(args?: SelectSubset<T, AdminProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AdminProfiles
     * const adminProfile = await prisma.adminProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AdminProfileUpdateManyArgs>(args: SelectSubset<T, AdminProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AdminProfiles and returns the data updated in the database.
     * @param {AdminProfileUpdateManyAndReturnArgs} args - Arguments to update many AdminProfiles.
     * @example
     * // Update many AdminProfiles
     * const adminProfile = await prisma.adminProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AdminProfiles and only return the `id`
     * const adminProfileWithIdOnly = await prisma.adminProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AdminProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, AdminProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AdminProfile.
     * @param {AdminProfileUpsertArgs} args - Arguments to update or create a AdminProfile.
     * @example
     * // Update or create a AdminProfile
     * const adminProfile = await prisma.adminProfile.upsert({
     *   create: {
     *     // ... data to create a AdminProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AdminProfile we want to update
     *   }
     * })
     */
    upsert<T extends AdminProfileUpsertArgs>(args: SelectSubset<T, AdminProfileUpsertArgs<ExtArgs>>): Prisma__AdminProfileClient<$Result.GetResult<Prisma.$AdminProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AdminProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileCountArgs} args - Arguments to filter AdminProfiles to count.
     * @example
     * // Count the number of AdminProfiles
     * const count = await prisma.adminProfile.count({
     *   where: {
     *     // ... the filter for the AdminProfiles we want to count
     *   }
     * })
    **/
    count<T extends AdminProfileCountArgs>(
      args?: Subset<T, AdminProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AdminProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AdminProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AdminProfileAggregateArgs>(args: Subset<T, AdminProfileAggregateArgs>): Prisma.PrismaPromise<GetAdminProfileAggregateType<T>>

    /**
     * Group by AdminProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AdminProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AdminProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AdminProfileGroupByArgs['orderBy'] }
        : { orderBy?: AdminProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AdminProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAdminProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AdminProfile model
   */
  readonly fields: AdminProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AdminProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AdminProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AdminProfile model
   */
  interface AdminProfileFieldRefs {
    readonly id: FieldRef<"AdminProfile", 'String'>
    readonly userId: FieldRef<"AdminProfile", 'String'>
    readonly adminLevel: FieldRef<"AdminProfile", 'AdminLevel'>
    readonly manageUsers: FieldRef<"AdminProfile", 'Boolean'>
    readonly manageComplaints: FieldRef<"AdminProfile", 'Boolean'>
    readonly manageDoubts: FieldRef<"AdminProfile", 'Boolean'>
    readonly viewAnalytics: FieldRef<"AdminProfile", 'Boolean'>
    readonly assignedDepartments: FieldRef<"AdminProfile", 'String[]'>
    readonly allowedCategories: FieldRef<"AdminProfile", 'String[]'>
    readonly complaintsAssigned: FieldRef<"AdminProfile", 'Int'>
    readonly complaintsClosed: FieldRef<"AdminProfile", 'Int'>
    readonly usersManaged: FieldRef<"AdminProfile", 'Int'>
    readonly lastLoginAt: FieldRef<"AdminProfile", 'DateTime'>
    readonly createdAt: FieldRef<"AdminProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"AdminProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AdminProfile findUnique
   */
  export type AdminProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * Filter, which AdminProfile to fetch.
     */
    where: AdminProfileWhereUniqueInput
  }

  /**
   * AdminProfile findUniqueOrThrow
   */
  export type AdminProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * Filter, which AdminProfile to fetch.
     */
    where: AdminProfileWhereUniqueInput
  }

  /**
   * AdminProfile findFirst
   */
  export type AdminProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * Filter, which AdminProfile to fetch.
     */
    where?: AdminProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminProfiles to fetch.
     */
    orderBy?: AdminProfileOrderByWithRelationInput | AdminProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminProfiles.
     */
    cursor?: AdminProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminProfiles.
     */
    distinct?: AdminProfileScalarFieldEnum | AdminProfileScalarFieldEnum[]
  }

  /**
   * AdminProfile findFirstOrThrow
   */
  export type AdminProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * Filter, which AdminProfile to fetch.
     */
    where?: AdminProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminProfiles to fetch.
     */
    orderBy?: AdminProfileOrderByWithRelationInput | AdminProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AdminProfiles.
     */
    cursor?: AdminProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AdminProfiles.
     */
    distinct?: AdminProfileScalarFieldEnum | AdminProfileScalarFieldEnum[]
  }

  /**
   * AdminProfile findMany
   */
  export type AdminProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * Filter, which AdminProfiles to fetch.
     */
    where?: AdminProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AdminProfiles to fetch.
     */
    orderBy?: AdminProfileOrderByWithRelationInput | AdminProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AdminProfiles.
     */
    cursor?: AdminProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AdminProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AdminProfiles.
     */
    skip?: number
    distinct?: AdminProfileScalarFieldEnum | AdminProfileScalarFieldEnum[]
  }

  /**
   * AdminProfile create
   */
  export type AdminProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a AdminProfile.
     */
    data: XOR<AdminProfileCreateInput, AdminProfileUncheckedCreateInput>
  }

  /**
   * AdminProfile createMany
   */
  export type AdminProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AdminProfiles.
     */
    data: AdminProfileCreateManyInput | AdminProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AdminProfile createManyAndReturn
   */
  export type AdminProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * The data used to create many AdminProfiles.
     */
    data: AdminProfileCreateManyInput | AdminProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AdminProfile update
   */
  export type AdminProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a AdminProfile.
     */
    data: XOR<AdminProfileUpdateInput, AdminProfileUncheckedUpdateInput>
    /**
     * Choose, which AdminProfile to update.
     */
    where: AdminProfileWhereUniqueInput
  }

  /**
   * AdminProfile updateMany
   */
  export type AdminProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AdminProfiles.
     */
    data: XOR<AdminProfileUpdateManyMutationInput, AdminProfileUncheckedUpdateManyInput>
    /**
     * Filter which AdminProfiles to update
     */
    where?: AdminProfileWhereInput
    /**
     * Limit how many AdminProfiles to update.
     */
    limit?: number
  }

  /**
   * AdminProfile updateManyAndReturn
   */
  export type AdminProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * The data used to update AdminProfiles.
     */
    data: XOR<AdminProfileUpdateManyMutationInput, AdminProfileUncheckedUpdateManyInput>
    /**
     * Filter which AdminProfiles to update
     */
    where?: AdminProfileWhereInput
    /**
     * Limit how many AdminProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * AdminProfile upsert
   */
  export type AdminProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the AdminProfile to update in case it exists.
     */
    where: AdminProfileWhereUniqueInput
    /**
     * In case the AdminProfile found by the `where` argument doesn't exist, create a new AdminProfile with this data.
     */
    create: XOR<AdminProfileCreateInput, AdminProfileUncheckedCreateInput>
    /**
     * In case the AdminProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AdminProfileUpdateInput, AdminProfileUncheckedUpdateInput>
  }

  /**
   * AdminProfile delete
   */
  export type AdminProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
    /**
     * Filter which AdminProfile to delete.
     */
    where: AdminProfileWhereUniqueInput
  }

  /**
   * AdminProfile deleteMany
   */
  export type AdminProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AdminProfiles to delete
     */
    where?: AdminProfileWhereInput
    /**
     * Limit how many AdminProfiles to delete.
     */
    limit?: number
  }

  /**
   * AdminProfile without action
   */
  export type AdminProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AdminProfile
     */
    select?: AdminProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AdminProfile
     */
    omit?: AdminProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AdminProfileInclude<ExtArgs> | null
  }


  /**
   * Model Doubt
   */

  export type AggregateDoubt = {
    _count: DoubtCountAggregateOutputType | null
    _avg: DoubtAvgAggregateOutputType | null
    _sum: DoubtSumAggregateOutputType | null
    _min: DoubtMinAggregateOutputType | null
    _max: DoubtMaxAggregateOutputType | null
  }

  export type DoubtAvgAggregateOutputType = {
    semester: number | null
    views: number | null
    upVoteCount: number | null
    answerCount: number | null
  }

  export type DoubtSumAggregateOutputType = {
    semester: number | null
    views: number | null
    upVoteCount: number | null
    answerCount: number | null
  }

  export type DoubtMinAggregateOutputType = {
    id: string | null
    title: string | null
    description: string | null
    semester: number | null
    subject: $Enums.Subject | null
    postedById: string | null
    status: $Enums.DoubtStatus | null
    views: number | null
    upVoteCount: number | null
    answerCount: number | null
    acceptedAnswerId: string | null
    edited: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type DoubtMaxAggregateOutputType = {
    id: string | null
    title: string | null
    description: string | null
    semester: number | null
    subject: $Enums.Subject | null
    postedById: string | null
    status: $Enums.DoubtStatus | null
    views: number | null
    upVoteCount: number | null
    answerCount: number | null
    acceptedAnswerId: string | null
    edited: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type DoubtCountAggregateOutputType = {
    id: number
    title: number
    description: number
    semester: number
    subject: number
    labels: number
    postedById: number
    status: number
    views: number
    upVoteCount: number
    answerCount: number
    acceptedAnswerId: number
    edited: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type DoubtAvgAggregateInputType = {
    semester?: true
    views?: true
    upVoteCount?: true
    answerCount?: true
  }

  export type DoubtSumAggregateInputType = {
    semester?: true
    views?: true
    upVoteCount?: true
    answerCount?: true
  }

  export type DoubtMinAggregateInputType = {
    id?: true
    title?: true
    description?: true
    semester?: true
    subject?: true
    postedById?: true
    status?: true
    views?: true
    upVoteCount?: true
    answerCount?: true
    acceptedAnswerId?: true
    edited?: true
    createdAt?: true
    updatedAt?: true
  }

  export type DoubtMaxAggregateInputType = {
    id?: true
    title?: true
    description?: true
    semester?: true
    subject?: true
    postedById?: true
    status?: true
    views?: true
    upVoteCount?: true
    answerCount?: true
    acceptedAnswerId?: true
    edited?: true
    createdAt?: true
    updatedAt?: true
  }

  export type DoubtCountAggregateInputType = {
    id?: true
    title?: true
    description?: true
    semester?: true
    subject?: true
    labels?: true
    postedById?: true
    status?: true
    views?: true
    upVoteCount?: true
    answerCount?: true
    acceptedAnswerId?: true
    edited?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type DoubtAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Doubt to aggregate.
     */
    where?: DoubtWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Doubts to fetch.
     */
    orderBy?: DoubtOrderByWithRelationInput | DoubtOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DoubtWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Doubts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Doubts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Doubts
    **/
    _count?: true | DoubtCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DoubtAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DoubtSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DoubtMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DoubtMaxAggregateInputType
  }

  export type GetDoubtAggregateType<T extends DoubtAggregateArgs> = {
        [P in keyof T & keyof AggregateDoubt]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDoubt[P]>
      : GetScalarType<T[P], AggregateDoubt[P]>
  }




  export type DoubtGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DoubtWhereInput
    orderBy?: DoubtOrderByWithAggregationInput | DoubtOrderByWithAggregationInput[]
    by: DoubtScalarFieldEnum[] | DoubtScalarFieldEnum
    having?: DoubtScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DoubtCountAggregateInputType | true
    _avg?: DoubtAvgAggregateInputType
    _sum?: DoubtSumAggregateInputType
    _min?: DoubtMinAggregateInputType
    _max?: DoubtMaxAggregateInputType
  }

  export type DoubtGroupByOutputType = {
    id: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels: string[]
    postedById: string
    status: $Enums.DoubtStatus
    views: number
    upVoteCount: number
    answerCount: number
    acceptedAnswerId: string | null
    edited: boolean
    createdAt: Date
    updatedAt: Date
    _count: DoubtCountAggregateOutputType | null
    _avg: DoubtAvgAggregateOutputType | null
    _sum: DoubtSumAggregateOutputType | null
    _min: DoubtMinAggregateOutputType | null
    _max: DoubtMaxAggregateOutputType | null
  }

  type GetDoubtGroupByPayload<T extends DoubtGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DoubtGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DoubtGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DoubtGroupByOutputType[P]>
            : GetScalarType<T[P], DoubtGroupByOutputType[P]>
        }
      >
    >


  export type DoubtSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    semester?: boolean
    subject?: boolean
    labels?: boolean
    postedById?: boolean
    status?: boolean
    views?: boolean
    upVoteCount?: boolean
    answerCount?: boolean
    acceptedAnswerId?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    postedBy?: boolean | UserDefaultArgs<ExtArgs>
    answers?: boolean | Doubt$answersArgs<ExtArgs>
    _count?: boolean | DoubtCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["doubt"]>

  export type DoubtSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    semester?: boolean
    subject?: boolean
    labels?: boolean
    postedById?: boolean
    status?: boolean
    views?: boolean
    upVoteCount?: boolean
    answerCount?: boolean
    acceptedAnswerId?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    postedBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["doubt"]>

  export type DoubtSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    semester?: boolean
    subject?: boolean
    labels?: boolean
    postedById?: boolean
    status?: boolean
    views?: boolean
    upVoteCount?: boolean
    answerCount?: boolean
    acceptedAnswerId?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    postedBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["doubt"]>

  export type DoubtSelectScalar = {
    id?: boolean
    title?: boolean
    description?: boolean
    semester?: boolean
    subject?: boolean
    labels?: boolean
    postedById?: boolean
    status?: boolean
    views?: boolean
    upVoteCount?: boolean
    answerCount?: boolean
    acceptedAnswerId?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type DoubtOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "title" | "description" | "semester" | "subject" | "labels" | "postedById" | "status" | "views" | "upVoteCount" | "answerCount" | "acceptedAnswerId" | "edited" | "createdAt" | "updatedAt", ExtArgs["result"]["doubt"]>
  export type DoubtInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    postedBy?: boolean | UserDefaultArgs<ExtArgs>
    answers?: boolean | Doubt$answersArgs<ExtArgs>
    _count?: boolean | DoubtCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type DoubtIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    postedBy?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type DoubtIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    postedBy?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $DoubtPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Doubt"
    objects: {
      postedBy: Prisma.$UserPayload<ExtArgs>
      answers: Prisma.$AnswerPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      title: string
      description: string
      semester: number
      subject: $Enums.Subject
      labels: string[]
      postedById: string
      status: $Enums.DoubtStatus
      views: number
      upVoteCount: number
      answerCount: number
      acceptedAnswerId: string | null
      edited: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["doubt"]>
    composites: {}
  }

  type DoubtGetPayload<S extends boolean | null | undefined | DoubtDefaultArgs> = $Result.GetResult<Prisma.$DoubtPayload, S>

  type DoubtCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DoubtFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DoubtCountAggregateInputType | true
    }

  export interface DoubtDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Doubt'], meta: { name: 'Doubt' } }
    /**
     * Find zero or one Doubt that matches the filter.
     * @param {DoubtFindUniqueArgs} args - Arguments to find a Doubt
     * @example
     * // Get one Doubt
     * const doubt = await prisma.doubt.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DoubtFindUniqueArgs>(args: SelectSubset<T, DoubtFindUniqueArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Doubt that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DoubtFindUniqueOrThrowArgs} args - Arguments to find a Doubt
     * @example
     * // Get one Doubt
     * const doubt = await prisma.doubt.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DoubtFindUniqueOrThrowArgs>(args: SelectSubset<T, DoubtFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Doubt that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtFindFirstArgs} args - Arguments to find a Doubt
     * @example
     * // Get one Doubt
     * const doubt = await prisma.doubt.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DoubtFindFirstArgs>(args?: SelectSubset<T, DoubtFindFirstArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Doubt that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtFindFirstOrThrowArgs} args - Arguments to find a Doubt
     * @example
     * // Get one Doubt
     * const doubt = await prisma.doubt.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DoubtFindFirstOrThrowArgs>(args?: SelectSubset<T, DoubtFindFirstOrThrowArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Doubts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Doubts
     * const doubts = await prisma.doubt.findMany()
     * 
     * // Get first 10 Doubts
     * const doubts = await prisma.doubt.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const doubtWithIdOnly = await prisma.doubt.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DoubtFindManyArgs>(args?: SelectSubset<T, DoubtFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Doubt.
     * @param {DoubtCreateArgs} args - Arguments to create a Doubt.
     * @example
     * // Create one Doubt
     * const Doubt = await prisma.doubt.create({
     *   data: {
     *     // ... data to create a Doubt
     *   }
     * })
     * 
     */
    create<T extends DoubtCreateArgs>(args: SelectSubset<T, DoubtCreateArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Doubts.
     * @param {DoubtCreateManyArgs} args - Arguments to create many Doubts.
     * @example
     * // Create many Doubts
     * const doubt = await prisma.doubt.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DoubtCreateManyArgs>(args?: SelectSubset<T, DoubtCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Doubts and returns the data saved in the database.
     * @param {DoubtCreateManyAndReturnArgs} args - Arguments to create many Doubts.
     * @example
     * // Create many Doubts
     * const doubt = await prisma.doubt.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Doubts and only return the `id`
     * const doubtWithIdOnly = await prisma.doubt.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DoubtCreateManyAndReturnArgs>(args?: SelectSubset<T, DoubtCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Doubt.
     * @param {DoubtDeleteArgs} args - Arguments to delete one Doubt.
     * @example
     * // Delete one Doubt
     * const Doubt = await prisma.doubt.delete({
     *   where: {
     *     // ... filter to delete one Doubt
     *   }
     * })
     * 
     */
    delete<T extends DoubtDeleteArgs>(args: SelectSubset<T, DoubtDeleteArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Doubt.
     * @param {DoubtUpdateArgs} args - Arguments to update one Doubt.
     * @example
     * // Update one Doubt
     * const doubt = await prisma.doubt.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DoubtUpdateArgs>(args: SelectSubset<T, DoubtUpdateArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Doubts.
     * @param {DoubtDeleteManyArgs} args - Arguments to filter Doubts to delete.
     * @example
     * // Delete a few Doubts
     * const { count } = await prisma.doubt.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DoubtDeleteManyArgs>(args?: SelectSubset<T, DoubtDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Doubts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Doubts
     * const doubt = await prisma.doubt.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DoubtUpdateManyArgs>(args: SelectSubset<T, DoubtUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Doubts and returns the data updated in the database.
     * @param {DoubtUpdateManyAndReturnArgs} args - Arguments to update many Doubts.
     * @example
     * // Update many Doubts
     * const doubt = await prisma.doubt.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Doubts and only return the `id`
     * const doubtWithIdOnly = await prisma.doubt.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends DoubtUpdateManyAndReturnArgs>(args: SelectSubset<T, DoubtUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Doubt.
     * @param {DoubtUpsertArgs} args - Arguments to update or create a Doubt.
     * @example
     * // Update or create a Doubt
     * const doubt = await prisma.doubt.upsert({
     *   create: {
     *     // ... data to create a Doubt
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Doubt we want to update
     *   }
     * })
     */
    upsert<T extends DoubtUpsertArgs>(args: SelectSubset<T, DoubtUpsertArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Doubts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtCountArgs} args - Arguments to filter Doubts to count.
     * @example
     * // Count the number of Doubts
     * const count = await prisma.doubt.count({
     *   where: {
     *     // ... the filter for the Doubts we want to count
     *   }
     * })
    **/
    count<T extends DoubtCountArgs>(
      args?: Subset<T, DoubtCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DoubtCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Doubt.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DoubtAggregateArgs>(args: Subset<T, DoubtAggregateArgs>): Prisma.PrismaPromise<GetDoubtAggregateType<T>>

    /**
     * Group by Doubt.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DoubtGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DoubtGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DoubtGroupByArgs['orderBy'] }
        : { orderBy?: DoubtGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DoubtGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDoubtGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Doubt model
   */
  readonly fields: DoubtFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Doubt.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DoubtClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    postedBy<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    answers<T extends Doubt$answersArgs<ExtArgs> = {}>(args?: Subset<T, Doubt$answersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Doubt model
   */
  interface DoubtFieldRefs {
    readonly id: FieldRef<"Doubt", 'String'>
    readonly title: FieldRef<"Doubt", 'String'>
    readonly description: FieldRef<"Doubt", 'String'>
    readonly semester: FieldRef<"Doubt", 'Int'>
    readonly subject: FieldRef<"Doubt", 'Subject'>
    readonly labels: FieldRef<"Doubt", 'String[]'>
    readonly postedById: FieldRef<"Doubt", 'String'>
    readonly status: FieldRef<"Doubt", 'DoubtStatus'>
    readonly views: FieldRef<"Doubt", 'Int'>
    readonly upVoteCount: FieldRef<"Doubt", 'Int'>
    readonly answerCount: FieldRef<"Doubt", 'Int'>
    readonly acceptedAnswerId: FieldRef<"Doubt", 'String'>
    readonly edited: FieldRef<"Doubt", 'Boolean'>
    readonly createdAt: FieldRef<"Doubt", 'DateTime'>
    readonly updatedAt: FieldRef<"Doubt", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Doubt findUnique
   */
  export type DoubtFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * Filter, which Doubt to fetch.
     */
    where: DoubtWhereUniqueInput
  }

  /**
   * Doubt findUniqueOrThrow
   */
  export type DoubtFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * Filter, which Doubt to fetch.
     */
    where: DoubtWhereUniqueInput
  }

  /**
   * Doubt findFirst
   */
  export type DoubtFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * Filter, which Doubt to fetch.
     */
    where?: DoubtWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Doubts to fetch.
     */
    orderBy?: DoubtOrderByWithRelationInput | DoubtOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Doubts.
     */
    cursor?: DoubtWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Doubts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Doubts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Doubts.
     */
    distinct?: DoubtScalarFieldEnum | DoubtScalarFieldEnum[]
  }

  /**
   * Doubt findFirstOrThrow
   */
  export type DoubtFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * Filter, which Doubt to fetch.
     */
    where?: DoubtWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Doubts to fetch.
     */
    orderBy?: DoubtOrderByWithRelationInput | DoubtOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Doubts.
     */
    cursor?: DoubtWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Doubts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Doubts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Doubts.
     */
    distinct?: DoubtScalarFieldEnum | DoubtScalarFieldEnum[]
  }

  /**
   * Doubt findMany
   */
  export type DoubtFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * Filter, which Doubts to fetch.
     */
    where?: DoubtWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Doubts to fetch.
     */
    orderBy?: DoubtOrderByWithRelationInput | DoubtOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Doubts.
     */
    cursor?: DoubtWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Doubts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Doubts.
     */
    skip?: number
    distinct?: DoubtScalarFieldEnum | DoubtScalarFieldEnum[]
  }

  /**
   * Doubt create
   */
  export type DoubtCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * The data needed to create a Doubt.
     */
    data: XOR<DoubtCreateInput, DoubtUncheckedCreateInput>
  }

  /**
   * Doubt createMany
   */
  export type DoubtCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Doubts.
     */
    data: DoubtCreateManyInput | DoubtCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Doubt createManyAndReturn
   */
  export type DoubtCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * The data used to create many Doubts.
     */
    data: DoubtCreateManyInput | DoubtCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Doubt update
   */
  export type DoubtUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * The data needed to update a Doubt.
     */
    data: XOR<DoubtUpdateInput, DoubtUncheckedUpdateInput>
    /**
     * Choose, which Doubt to update.
     */
    where: DoubtWhereUniqueInput
  }

  /**
   * Doubt updateMany
   */
  export type DoubtUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Doubts.
     */
    data: XOR<DoubtUpdateManyMutationInput, DoubtUncheckedUpdateManyInput>
    /**
     * Filter which Doubts to update
     */
    where?: DoubtWhereInput
    /**
     * Limit how many Doubts to update.
     */
    limit?: number
  }

  /**
   * Doubt updateManyAndReturn
   */
  export type DoubtUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * The data used to update Doubts.
     */
    data: XOR<DoubtUpdateManyMutationInput, DoubtUncheckedUpdateManyInput>
    /**
     * Filter which Doubts to update
     */
    where?: DoubtWhereInput
    /**
     * Limit how many Doubts to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Doubt upsert
   */
  export type DoubtUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * The filter to search for the Doubt to update in case it exists.
     */
    where: DoubtWhereUniqueInput
    /**
     * In case the Doubt found by the `where` argument doesn't exist, create a new Doubt with this data.
     */
    create: XOR<DoubtCreateInput, DoubtUncheckedCreateInput>
    /**
     * In case the Doubt was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DoubtUpdateInput, DoubtUncheckedUpdateInput>
  }

  /**
   * Doubt delete
   */
  export type DoubtDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
    /**
     * Filter which Doubt to delete.
     */
    where: DoubtWhereUniqueInput
  }

  /**
   * Doubt deleteMany
   */
  export type DoubtDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Doubts to delete
     */
    where?: DoubtWhereInput
    /**
     * Limit how many Doubts to delete.
     */
    limit?: number
  }

  /**
   * Doubt.answers
   */
  export type Doubt$answersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    where?: AnswerWhereInput
    orderBy?: AnswerOrderByWithRelationInput | AnswerOrderByWithRelationInput[]
    cursor?: AnswerWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AnswerScalarFieldEnum | AnswerScalarFieldEnum[]
  }

  /**
   * Doubt without action
   */
  export type DoubtDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Doubt
     */
    select?: DoubtSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Doubt
     */
    omit?: DoubtOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DoubtInclude<ExtArgs> | null
  }


  /**
   * Model Answer
   */

  export type AggregateAnswer = {
    _count: AnswerCountAggregateOutputType | null
    _avg: AnswerAvgAggregateOutputType | null
    _sum: AnswerSumAggregateOutputType | null
    _min: AnswerMinAggregateOutputType | null
    _max: AnswerMaxAggregateOutputType | null
  }

  export type AnswerAvgAggregateOutputType = {
    upvotes: number | null
  }

  export type AnswerSumAggregateOutputType = {
    upvotes: number | null
  }

  export type AnswerMinAggregateOutputType = {
    id: string | null
    doubtId: string | null
    content: string | null
    answeredById: string | null
    upvotes: number | null
    isVerified: boolean | null
    isAccepted: boolean | null
    edited: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AnswerMaxAggregateOutputType = {
    id: string | null
    doubtId: string | null
    content: string | null
    answeredById: string | null
    upvotes: number | null
    isVerified: boolean | null
    isAccepted: boolean | null
    edited: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AnswerCountAggregateOutputType = {
    id: number
    doubtId: number
    content: number
    answeredById: number
    upvotes: number
    isVerified: number
    isAccepted: number
    edited: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AnswerAvgAggregateInputType = {
    upvotes?: true
  }

  export type AnswerSumAggregateInputType = {
    upvotes?: true
  }

  export type AnswerMinAggregateInputType = {
    id?: true
    doubtId?: true
    content?: true
    answeredById?: true
    upvotes?: true
    isVerified?: true
    isAccepted?: true
    edited?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AnswerMaxAggregateInputType = {
    id?: true
    doubtId?: true
    content?: true
    answeredById?: true
    upvotes?: true
    isVerified?: true
    isAccepted?: true
    edited?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AnswerCountAggregateInputType = {
    id?: true
    doubtId?: true
    content?: true
    answeredById?: true
    upvotes?: true
    isVerified?: true
    isAccepted?: true
    edited?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AnswerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Answer to aggregate.
     */
    where?: AnswerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Answers to fetch.
     */
    orderBy?: AnswerOrderByWithRelationInput | AnswerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AnswerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Answers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Answers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Answers
    **/
    _count?: true | AnswerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AnswerAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AnswerSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AnswerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AnswerMaxAggregateInputType
  }

  export type GetAnswerAggregateType<T extends AnswerAggregateArgs> = {
        [P in keyof T & keyof AggregateAnswer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAnswer[P]>
      : GetScalarType<T[P], AggregateAnswer[P]>
  }




  export type AnswerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AnswerWhereInput
    orderBy?: AnswerOrderByWithAggregationInput | AnswerOrderByWithAggregationInput[]
    by: AnswerScalarFieldEnum[] | AnswerScalarFieldEnum
    having?: AnswerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AnswerCountAggregateInputType | true
    _avg?: AnswerAvgAggregateInputType
    _sum?: AnswerSumAggregateInputType
    _min?: AnswerMinAggregateInputType
    _max?: AnswerMaxAggregateInputType
  }

  export type AnswerGroupByOutputType = {
    id: string
    doubtId: string
    content: string
    answeredById: string
    upvotes: number
    isVerified: boolean
    isAccepted: boolean
    edited: boolean
    createdAt: Date
    updatedAt: Date
    _count: AnswerCountAggregateOutputType | null
    _avg: AnswerAvgAggregateOutputType | null
    _sum: AnswerSumAggregateOutputType | null
    _min: AnswerMinAggregateOutputType | null
    _max: AnswerMaxAggregateOutputType | null
  }

  type GetAnswerGroupByPayload<T extends AnswerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AnswerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AnswerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AnswerGroupByOutputType[P]>
            : GetScalarType<T[P], AnswerGroupByOutputType[P]>
        }
      >
    >


  export type AnswerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    doubtId?: boolean
    content?: boolean
    answeredById?: boolean
    upvotes?: boolean
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    doubt?: boolean | DoubtDefaultArgs<ExtArgs>
    answeredBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["answer"]>

  export type AnswerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    doubtId?: boolean
    content?: boolean
    answeredById?: boolean
    upvotes?: boolean
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    doubt?: boolean | DoubtDefaultArgs<ExtArgs>
    answeredBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["answer"]>

  export type AnswerSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    doubtId?: boolean
    content?: boolean
    answeredById?: boolean
    upvotes?: boolean
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    doubt?: boolean | DoubtDefaultArgs<ExtArgs>
    answeredBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["answer"]>

  export type AnswerSelectScalar = {
    id?: boolean
    doubtId?: boolean
    content?: boolean
    answeredById?: boolean
    upvotes?: boolean
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AnswerOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "doubtId" | "content" | "answeredById" | "upvotes" | "isVerified" | "isAccepted" | "edited" | "createdAt" | "updatedAt", ExtArgs["result"]["answer"]>
  export type AnswerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    doubt?: boolean | DoubtDefaultArgs<ExtArgs>
    answeredBy?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AnswerIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    doubt?: boolean | DoubtDefaultArgs<ExtArgs>
    answeredBy?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AnswerIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    doubt?: boolean | DoubtDefaultArgs<ExtArgs>
    answeredBy?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $AnswerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Answer"
    objects: {
      doubt: Prisma.$DoubtPayload<ExtArgs>
      answeredBy: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      doubtId: string
      content: string
      answeredById: string
      upvotes: number
      isVerified: boolean
      isAccepted: boolean
      edited: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["answer"]>
    composites: {}
  }

  type AnswerGetPayload<S extends boolean | null | undefined | AnswerDefaultArgs> = $Result.GetResult<Prisma.$AnswerPayload, S>

  type AnswerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AnswerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AnswerCountAggregateInputType | true
    }

  export interface AnswerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Answer'], meta: { name: 'Answer' } }
    /**
     * Find zero or one Answer that matches the filter.
     * @param {AnswerFindUniqueArgs} args - Arguments to find a Answer
     * @example
     * // Get one Answer
     * const answer = await prisma.answer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AnswerFindUniqueArgs>(args: SelectSubset<T, AnswerFindUniqueArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Answer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AnswerFindUniqueOrThrowArgs} args - Arguments to find a Answer
     * @example
     * // Get one Answer
     * const answer = await prisma.answer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AnswerFindUniqueOrThrowArgs>(args: SelectSubset<T, AnswerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Answer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerFindFirstArgs} args - Arguments to find a Answer
     * @example
     * // Get one Answer
     * const answer = await prisma.answer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AnswerFindFirstArgs>(args?: SelectSubset<T, AnswerFindFirstArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Answer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerFindFirstOrThrowArgs} args - Arguments to find a Answer
     * @example
     * // Get one Answer
     * const answer = await prisma.answer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AnswerFindFirstOrThrowArgs>(args?: SelectSubset<T, AnswerFindFirstOrThrowArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Answers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Answers
     * const answers = await prisma.answer.findMany()
     * 
     * // Get first 10 Answers
     * const answers = await prisma.answer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const answerWithIdOnly = await prisma.answer.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AnswerFindManyArgs>(args?: SelectSubset<T, AnswerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Answer.
     * @param {AnswerCreateArgs} args - Arguments to create a Answer.
     * @example
     * // Create one Answer
     * const Answer = await prisma.answer.create({
     *   data: {
     *     // ... data to create a Answer
     *   }
     * })
     * 
     */
    create<T extends AnswerCreateArgs>(args: SelectSubset<T, AnswerCreateArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Answers.
     * @param {AnswerCreateManyArgs} args - Arguments to create many Answers.
     * @example
     * // Create many Answers
     * const answer = await prisma.answer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AnswerCreateManyArgs>(args?: SelectSubset<T, AnswerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Answers and returns the data saved in the database.
     * @param {AnswerCreateManyAndReturnArgs} args - Arguments to create many Answers.
     * @example
     * // Create many Answers
     * const answer = await prisma.answer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Answers and only return the `id`
     * const answerWithIdOnly = await prisma.answer.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AnswerCreateManyAndReturnArgs>(args?: SelectSubset<T, AnswerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Answer.
     * @param {AnswerDeleteArgs} args - Arguments to delete one Answer.
     * @example
     * // Delete one Answer
     * const Answer = await prisma.answer.delete({
     *   where: {
     *     // ... filter to delete one Answer
     *   }
     * })
     * 
     */
    delete<T extends AnswerDeleteArgs>(args: SelectSubset<T, AnswerDeleteArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Answer.
     * @param {AnswerUpdateArgs} args - Arguments to update one Answer.
     * @example
     * // Update one Answer
     * const answer = await prisma.answer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AnswerUpdateArgs>(args: SelectSubset<T, AnswerUpdateArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Answers.
     * @param {AnswerDeleteManyArgs} args - Arguments to filter Answers to delete.
     * @example
     * // Delete a few Answers
     * const { count } = await prisma.answer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AnswerDeleteManyArgs>(args?: SelectSubset<T, AnswerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Answers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Answers
     * const answer = await prisma.answer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AnswerUpdateManyArgs>(args: SelectSubset<T, AnswerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Answers and returns the data updated in the database.
     * @param {AnswerUpdateManyAndReturnArgs} args - Arguments to update many Answers.
     * @example
     * // Update many Answers
     * const answer = await prisma.answer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Answers and only return the `id`
     * const answerWithIdOnly = await prisma.answer.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AnswerUpdateManyAndReturnArgs>(args: SelectSubset<T, AnswerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Answer.
     * @param {AnswerUpsertArgs} args - Arguments to update or create a Answer.
     * @example
     * // Update or create a Answer
     * const answer = await prisma.answer.upsert({
     *   create: {
     *     // ... data to create a Answer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Answer we want to update
     *   }
     * })
     */
    upsert<T extends AnswerUpsertArgs>(args: SelectSubset<T, AnswerUpsertArgs<ExtArgs>>): Prisma__AnswerClient<$Result.GetResult<Prisma.$AnswerPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Answers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerCountArgs} args - Arguments to filter Answers to count.
     * @example
     * // Count the number of Answers
     * const count = await prisma.answer.count({
     *   where: {
     *     // ... the filter for the Answers we want to count
     *   }
     * })
    **/
    count<T extends AnswerCountArgs>(
      args?: Subset<T, AnswerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AnswerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Answer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AnswerAggregateArgs>(args: Subset<T, AnswerAggregateArgs>): Prisma.PrismaPromise<GetAnswerAggregateType<T>>

    /**
     * Group by Answer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AnswerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AnswerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AnswerGroupByArgs['orderBy'] }
        : { orderBy?: AnswerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AnswerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAnswerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Answer model
   */
  readonly fields: AnswerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Answer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AnswerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    doubt<T extends DoubtDefaultArgs<ExtArgs> = {}>(args?: Subset<T, DoubtDefaultArgs<ExtArgs>>): Prisma__DoubtClient<$Result.GetResult<Prisma.$DoubtPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    answeredBy<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Answer model
   */
  interface AnswerFieldRefs {
    readonly id: FieldRef<"Answer", 'String'>
    readonly doubtId: FieldRef<"Answer", 'String'>
    readonly content: FieldRef<"Answer", 'String'>
    readonly answeredById: FieldRef<"Answer", 'String'>
    readonly upvotes: FieldRef<"Answer", 'Int'>
    readonly isVerified: FieldRef<"Answer", 'Boolean'>
    readonly isAccepted: FieldRef<"Answer", 'Boolean'>
    readonly edited: FieldRef<"Answer", 'Boolean'>
    readonly createdAt: FieldRef<"Answer", 'DateTime'>
    readonly updatedAt: FieldRef<"Answer", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Answer findUnique
   */
  export type AnswerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * Filter, which Answer to fetch.
     */
    where: AnswerWhereUniqueInput
  }

  /**
   * Answer findUniqueOrThrow
   */
  export type AnswerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * Filter, which Answer to fetch.
     */
    where: AnswerWhereUniqueInput
  }

  /**
   * Answer findFirst
   */
  export type AnswerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * Filter, which Answer to fetch.
     */
    where?: AnswerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Answers to fetch.
     */
    orderBy?: AnswerOrderByWithRelationInput | AnswerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Answers.
     */
    cursor?: AnswerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Answers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Answers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Answers.
     */
    distinct?: AnswerScalarFieldEnum | AnswerScalarFieldEnum[]
  }

  /**
   * Answer findFirstOrThrow
   */
  export type AnswerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * Filter, which Answer to fetch.
     */
    where?: AnswerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Answers to fetch.
     */
    orderBy?: AnswerOrderByWithRelationInput | AnswerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Answers.
     */
    cursor?: AnswerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Answers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Answers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Answers.
     */
    distinct?: AnswerScalarFieldEnum | AnswerScalarFieldEnum[]
  }

  /**
   * Answer findMany
   */
  export type AnswerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * Filter, which Answers to fetch.
     */
    where?: AnswerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Answers to fetch.
     */
    orderBy?: AnswerOrderByWithRelationInput | AnswerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Answers.
     */
    cursor?: AnswerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Answers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Answers.
     */
    skip?: number
    distinct?: AnswerScalarFieldEnum | AnswerScalarFieldEnum[]
  }

  /**
   * Answer create
   */
  export type AnswerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * The data needed to create a Answer.
     */
    data: XOR<AnswerCreateInput, AnswerUncheckedCreateInput>
  }

  /**
   * Answer createMany
   */
  export type AnswerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Answers.
     */
    data: AnswerCreateManyInput | AnswerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Answer createManyAndReturn
   */
  export type AnswerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * The data used to create many Answers.
     */
    data: AnswerCreateManyInput | AnswerCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Answer update
   */
  export type AnswerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * The data needed to update a Answer.
     */
    data: XOR<AnswerUpdateInput, AnswerUncheckedUpdateInput>
    /**
     * Choose, which Answer to update.
     */
    where: AnswerWhereUniqueInput
  }

  /**
   * Answer updateMany
   */
  export type AnswerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Answers.
     */
    data: XOR<AnswerUpdateManyMutationInput, AnswerUncheckedUpdateManyInput>
    /**
     * Filter which Answers to update
     */
    where?: AnswerWhereInput
    /**
     * Limit how many Answers to update.
     */
    limit?: number
  }

  /**
   * Answer updateManyAndReturn
   */
  export type AnswerUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * The data used to update Answers.
     */
    data: XOR<AnswerUpdateManyMutationInput, AnswerUncheckedUpdateManyInput>
    /**
     * Filter which Answers to update
     */
    where?: AnswerWhereInput
    /**
     * Limit how many Answers to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Answer upsert
   */
  export type AnswerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * The filter to search for the Answer to update in case it exists.
     */
    where: AnswerWhereUniqueInput
    /**
     * In case the Answer found by the `where` argument doesn't exist, create a new Answer with this data.
     */
    create: XOR<AnswerCreateInput, AnswerUncheckedCreateInput>
    /**
     * In case the Answer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AnswerUpdateInput, AnswerUncheckedUpdateInput>
  }

  /**
   * Answer delete
   */
  export type AnswerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
    /**
     * Filter which Answer to delete.
     */
    where: AnswerWhereUniqueInput
  }

  /**
   * Answer deleteMany
   */
  export type AnswerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Answers to delete
     */
    where?: AnswerWhereInput
    /**
     * Limit how many Answers to delete.
     */
    limit?: number
  }

  /**
   * Answer without action
   */
  export type AnswerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Answer
     */
    select?: AnswerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Answer
     */
    omit?: AnswerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AnswerInclude<ExtArgs> | null
  }


  /**
   * Model Complaint
   */

  export type AggregateComplaint = {
    _count: ComplaintCountAggregateOutputType | null
    _avg: ComplaintAvgAggregateOutputType | null
    _sum: ComplaintSumAggregateOutputType | null
    _min: ComplaintMinAggregateOutputType | null
    _max: ComplaintMaxAggregateOutputType | null
  }

  export type ComplaintAvgAggregateOutputType = {
    priority: number | null
    feedbackRating: number | null
  }

  export type ComplaintSumAggregateOutputType = {
    priority: number | null
    feedbackRating: number | null
  }

  export type ComplaintMinAggregateOutputType = {
    id: string | null
    title: string | null
    description: string | null
    category: $Enums.ComplaintCategory | null
    classroomNumber: string | null
    block: string | null
    status: $Enums.ComplaintStatus | null
    priority: number | null
    raisedById: string | null
    assignedToId: string | null
    resolutionNote: string | null
    feedbackRating: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ComplaintMaxAggregateOutputType = {
    id: string | null
    title: string | null
    description: string | null
    category: $Enums.ComplaintCategory | null
    classroomNumber: string | null
    block: string | null
    status: $Enums.ComplaintStatus | null
    priority: number | null
    raisedById: string | null
    assignedToId: string | null
    resolutionNote: string | null
    feedbackRating: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ComplaintCountAggregateOutputType = {
    id: number
    title: number
    description: number
    category: number
    classroomNumber: number
    block: number
    status: number
    priority: number
    raisedById: number
    assignedToId: number
    resolutionNote: number
    feedbackRating: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ComplaintAvgAggregateInputType = {
    priority?: true
    feedbackRating?: true
  }

  export type ComplaintSumAggregateInputType = {
    priority?: true
    feedbackRating?: true
  }

  export type ComplaintMinAggregateInputType = {
    id?: true
    title?: true
    description?: true
    category?: true
    classroomNumber?: true
    block?: true
    status?: true
    priority?: true
    raisedById?: true
    assignedToId?: true
    resolutionNote?: true
    feedbackRating?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ComplaintMaxAggregateInputType = {
    id?: true
    title?: true
    description?: true
    category?: true
    classroomNumber?: true
    block?: true
    status?: true
    priority?: true
    raisedById?: true
    assignedToId?: true
    resolutionNote?: true
    feedbackRating?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ComplaintCountAggregateInputType = {
    id?: true
    title?: true
    description?: true
    category?: true
    classroomNumber?: true
    block?: true
    status?: true
    priority?: true
    raisedById?: true
    assignedToId?: true
    resolutionNote?: true
    feedbackRating?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ComplaintAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Complaint to aggregate.
     */
    where?: ComplaintWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Complaints to fetch.
     */
    orderBy?: ComplaintOrderByWithRelationInput | ComplaintOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ComplaintWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Complaints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Complaints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Complaints
    **/
    _count?: true | ComplaintCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ComplaintAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ComplaintSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ComplaintMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ComplaintMaxAggregateInputType
  }

  export type GetComplaintAggregateType<T extends ComplaintAggregateArgs> = {
        [P in keyof T & keyof AggregateComplaint]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateComplaint[P]>
      : GetScalarType<T[P], AggregateComplaint[P]>
  }




  export type ComplaintGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ComplaintWhereInput
    orderBy?: ComplaintOrderByWithAggregationInput | ComplaintOrderByWithAggregationInput[]
    by: ComplaintScalarFieldEnum[] | ComplaintScalarFieldEnum
    having?: ComplaintScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ComplaintCountAggregateInputType | true
    _avg?: ComplaintAvgAggregateInputType
    _sum?: ComplaintSumAggregateInputType
    _min?: ComplaintMinAggregateInputType
    _max?: ComplaintMaxAggregateInputType
  }

  export type ComplaintGroupByOutputType = {
    id: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status: $Enums.ComplaintStatus
    priority: number
    raisedById: string
    assignedToId: string | null
    resolutionNote: string | null
    feedbackRating: number | null
    createdAt: Date
    updatedAt: Date
    _count: ComplaintCountAggregateOutputType | null
    _avg: ComplaintAvgAggregateOutputType | null
    _sum: ComplaintSumAggregateOutputType | null
    _min: ComplaintMinAggregateOutputType | null
    _max: ComplaintMaxAggregateOutputType | null
  }

  type GetComplaintGroupByPayload<T extends ComplaintGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ComplaintGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ComplaintGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ComplaintGroupByOutputType[P]>
            : GetScalarType<T[P], ComplaintGroupByOutputType[P]>
        }
      >
    >


  export type ComplaintSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    classroomNumber?: boolean
    block?: boolean
    status?: boolean
    priority?: boolean
    raisedById?: boolean
    assignedToId?: boolean
    resolutionNote?: boolean
    feedbackRating?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    raisedBy?: boolean | UserDefaultArgs<ExtArgs>
    assignedTo?: boolean | Complaint$assignedToArgs<ExtArgs>
  }, ExtArgs["result"]["complaint"]>

  export type ComplaintSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    classroomNumber?: boolean
    block?: boolean
    status?: boolean
    priority?: boolean
    raisedById?: boolean
    assignedToId?: boolean
    resolutionNote?: boolean
    feedbackRating?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    raisedBy?: boolean | UserDefaultArgs<ExtArgs>
    assignedTo?: boolean | Complaint$assignedToArgs<ExtArgs>
  }, ExtArgs["result"]["complaint"]>

  export type ComplaintSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    classroomNumber?: boolean
    block?: boolean
    status?: boolean
    priority?: boolean
    raisedById?: boolean
    assignedToId?: boolean
    resolutionNote?: boolean
    feedbackRating?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    raisedBy?: boolean | UserDefaultArgs<ExtArgs>
    assignedTo?: boolean | Complaint$assignedToArgs<ExtArgs>
  }, ExtArgs["result"]["complaint"]>

  export type ComplaintSelectScalar = {
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    classroomNumber?: boolean
    block?: boolean
    status?: boolean
    priority?: boolean
    raisedById?: boolean
    assignedToId?: boolean
    resolutionNote?: boolean
    feedbackRating?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ComplaintOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "title" | "description" | "category" | "classroomNumber" | "block" | "status" | "priority" | "raisedById" | "assignedToId" | "resolutionNote" | "feedbackRating" | "createdAt" | "updatedAt", ExtArgs["result"]["complaint"]>
  export type ComplaintInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    raisedBy?: boolean | UserDefaultArgs<ExtArgs>
    assignedTo?: boolean | Complaint$assignedToArgs<ExtArgs>
  }
  export type ComplaintIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    raisedBy?: boolean | UserDefaultArgs<ExtArgs>
    assignedTo?: boolean | Complaint$assignedToArgs<ExtArgs>
  }
  export type ComplaintIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    raisedBy?: boolean | UserDefaultArgs<ExtArgs>
    assignedTo?: boolean | Complaint$assignedToArgs<ExtArgs>
  }

  export type $ComplaintPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Complaint"
    objects: {
      raisedBy: Prisma.$UserPayload<ExtArgs>
      assignedTo: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      title: string
      description: string
      category: $Enums.ComplaintCategory
      classroomNumber: string
      block: string
      status: $Enums.ComplaintStatus
      priority: number
      raisedById: string
      assignedToId: string | null
      resolutionNote: string | null
      feedbackRating: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["complaint"]>
    composites: {}
  }

  type ComplaintGetPayload<S extends boolean | null | undefined | ComplaintDefaultArgs> = $Result.GetResult<Prisma.$ComplaintPayload, S>

  type ComplaintCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ComplaintFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ComplaintCountAggregateInputType | true
    }

  export interface ComplaintDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Complaint'], meta: { name: 'Complaint' } }
    /**
     * Find zero or one Complaint that matches the filter.
     * @param {ComplaintFindUniqueArgs} args - Arguments to find a Complaint
     * @example
     * // Get one Complaint
     * const complaint = await prisma.complaint.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ComplaintFindUniqueArgs>(args: SelectSubset<T, ComplaintFindUniqueArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Complaint that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ComplaintFindUniqueOrThrowArgs} args - Arguments to find a Complaint
     * @example
     * // Get one Complaint
     * const complaint = await prisma.complaint.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ComplaintFindUniqueOrThrowArgs>(args: SelectSubset<T, ComplaintFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Complaint that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintFindFirstArgs} args - Arguments to find a Complaint
     * @example
     * // Get one Complaint
     * const complaint = await prisma.complaint.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ComplaintFindFirstArgs>(args?: SelectSubset<T, ComplaintFindFirstArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Complaint that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintFindFirstOrThrowArgs} args - Arguments to find a Complaint
     * @example
     * // Get one Complaint
     * const complaint = await prisma.complaint.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ComplaintFindFirstOrThrowArgs>(args?: SelectSubset<T, ComplaintFindFirstOrThrowArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Complaints that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Complaints
     * const complaints = await prisma.complaint.findMany()
     * 
     * // Get first 10 Complaints
     * const complaints = await prisma.complaint.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const complaintWithIdOnly = await prisma.complaint.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ComplaintFindManyArgs>(args?: SelectSubset<T, ComplaintFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Complaint.
     * @param {ComplaintCreateArgs} args - Arguments to create a Complaint.
     * @example
     * // Create one Complaint
     * const Complaint = await prisma.complaint.create({
     *   data: {
     *     // ... data to create a Complaint
     *   }
     * })
     * 
     */
    create<T extends ComplaintCreateArgs>(args: SelectSubset<T, ComplaintCreateArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Complaints.
     * @param {ComplaintCreateManyArgs} args - Arguments to create many Complaints.
     * @example
     * // Create many Complaints
     * const complaint = await prisma.complaint.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ComplaintCreateManyArgs>(args?: SelectSubset<T, ComplaintCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Complaints and returns the data saved in the database.
     * @param {ComplaintCreateManyAndReturnArgs} args - Arguments to create many Complaints.
     * @example
     * // Create many Complaints
     * const complaint = await prisma.complaint.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Complaints and only return the `id`
     * const complaintWithIdOnly = await prisma.complaint.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ComplaintCreateManyAndReturnArgs>(args?: SelectSubset<T, ComplaintCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Complaint.
     * @param {ComplaintDeleteArgs} args - Arguments to delete one Complaint.
     * @example
     * // Delete one Complaint
     * const Complaint = await prisma.complaint.delete({
     *   where: {
     *     // ... filter to delete one Complaint
     *   }
     * })
     * 
     */
    delete<T extends ComplaintDeleteArgs>(args: SelectSubset<T, ComplaintDeleteArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Complaint.
     * @param {ComplaintUpdateArgs} args - Arguments to update one Complaint.
     * @example
     * // Update one Complaint
     * const complaint = await prisma.complaint.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ComplaintUpdateArgs>(args: SelectSubset<T, ComplaintUpdateArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Complaints.
     * @param {ComplaintDeleteManyArgs} args - Arguments to filter Complaints to delete.
     * @example
     * // Delete a few Complaints
     * const { count } = await prisma.complaint.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ComplaintDeleteManyArgs>(args?: SelectSubset<T, ComplaintDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Complaints.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Complaints
     * const complaint = await prisma.complaint.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ComplaintUpdateManyArgs>(args: SelectSubset<T, ComplaintUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Complaints and returns the data updated in the database.
     * @param {ComplaintUpdateManyAndReturnArgs} args - Arguments to update many Complaints.
     * @example
     * // Update many Complaints
     * const complaint = await prisma.complaint.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Complaints and only return the `id`
     * const complaintWithIdOnly = await prisma.complaint.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ComplaintUpdateManyAndReturnArgs>(args: SelectSubset<T, ComplaintUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Complaint.
     * @param {ComplaintUpsertArgs} args - Arguments to update or create a Complaint.
     * @example
     * // Update or create a Complaint
     * const complaint = await prisma.complaint.upsert({
     *   create: {
     *     // ... data to create a Complaint
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Complaint we want to update
     *   }
     * })
     */
    upsert<T extends ComplaintUpsertArgs>(args: SelectSubset<T, ComplaintUpsertArgs<ExtArgs>>): Prisma__ComplaintClient<$Result.GetResult<Prisma.$ComplaintPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Complaints.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintCountArgs} args - Arguments to filter Complaints to count.
     * @example
     * // Count the number of Complaints
     * const count = await prisma.complaint.count({
     *   where: {
     *     // ... the filter for the Complaints we want to count
     *   }
     * })
    **/
    count<T extends ComplaintCountArgs>(
      args?: Subset<T, ComplaintCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ComplaintCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Complaint.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ComplaintAggregateArgs>(args: Subset<T, ComplaintAggregateArgs>): Prisma.PrismaPromise<GetComplaintAggregateType<T>>

    /**
     * Group by Complaint.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComplaintGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ComplaintGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ComplaintGroupByArgs['orderBy'] }
        : { orderBy?: ComplaintGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ComplaintGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetComplaintGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Complaint model
   */
  readonly fields: ComplaintFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Complaint.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ComplaintClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    raisedBy<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    assignedTo<T extends Complaint$assignedToArgs<ExtArgs> = {}>(args?: Subset<T, Complaint$assignedToArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Complaint model
   */
  interface ComplaintFieldRefs {
    readonly id: FieldRef<"Complaint", 'String'>
    readonly title: FieldRef<"Complaint", 'String'>
    readonly description: FieldRef<"Complaint", 'String'>
    readonly category: FieldRef<"Complaint", 'ComplaintCategory'>
    readonly classroomNumber: FieldRef<"Complaint", 'String'>
    readonly block: FieldRef<"Complaint", 'String'>
    readonly status: FieldRef<"Complaint", 'ComplaintStatus'>
    readonly priority: FieldRef<"Complaint", 'Int'>
    readonly raisedById: FieldRef<"Complaint", 'String'>
    readonly assignedToId: FieldRef<"Complaint", 'String'>
    readonly resolutionNote: FieldRef<"Complaint", 'String'>
    readonly feedbackRating: FieldRef<"Complaint", 'Int'>
    readonly createdAt: FieldRef<"Complaint", 'DateTime'>
    readonly updatedAt: FieldRef<"Complaint", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Complaint findUnique
   */
  export type ComplaintFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * Filter, which Complaint to fetch.
     */
    where: ComplaintWhereUniqueInput
  }

  /**
   * Complaint findUniqueOrThrow
   */
  export type ComplaintFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * Filter, which Complaint to fetch.
     */
    where: ComplaintWhereUniqueInput
  }

  /**
   * Complaint findFirst
   */
  export type ComplaintFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * Filter, which Complaint to fetch.
     */
    where?: ComplaintWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Complaints to fetch.
     */
    orderBy?: ComplaintOrderByWithRelationInput | ComplaintOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Complaints.
     */
    cursor?: ComplaintWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Complaints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Complaints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Complaints.
     */
    distinct?: ComplaintScalarFieldEnum | ComplaintScalarFieldEnum[]
  }

  /**
   * Complaint findFirstOrThrow
   */
  export type ComplaintFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * Filter, which Complaint to fetch.
     */
    where?: ComplaintWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Complaints to fetch.
     */
    orderBy?: ComplaintOrderByWithRelationInput | ComplaintOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Complaints.
     */
    cursor?: ComplaintWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Complaints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Complaints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Complaints.
     */
    distinct?: ComplaintScalarFieldEnum | ComplaintScalarFieldEnum[]
  }

  /**
   * Complaint findMany
   */
  export type ComplaintFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * Filter, which Complaints to fetch.
     */
    where?: ComplaintWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Complaints to fetch.
     */
    orderBy?: ComplaintOrderByWithRelationInput | ComplaintOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Complaints.
     */
    cursor?: ComplaintWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Complaints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Complaints.
     */
    skip?: number
    distinct?: ComplaintScalarFieldEnum | ComplaintScalarFieldEnum[]
  }

  /**
   * Complaint create
   */
  export type ComplaintCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * The data needed to create a Complaint.
     */
    data: XOR<ComplaintCreateInput, ComplaintUncheckedCreateInput>
  }

  /**
   * Complaint createMany
   */
  export type ComplaintCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Complaints.
     */
    data: ComplaintCreateManyInput | ComplaintCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Complaint createManyAndReturn
   */
  export type ComplaintCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * The data used to create many Complaints.
     */
    data: ComplaintCreateManyInput | ComplaintCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Complaint update
   */
  export type ComplaintUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * The data needed to update a Complaint.
     */
    data: XOR<ComplaintUpdateInput, ComplaintUncheckedUpdateInput>
    /**
     * Choose, which Complaint to update.
     */
    where: ComplaintWhereUniqueInput
  }

  /**
   * Complaint updateMany
   */
  export type ComplaintUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Complaints.
     */
    data: XOR<ComplaintUpdateManyMutationInput, ComplaintUncheckedUpdateManyInput>
    /**
     * Filter which Complaints to update
     */
    where?: ComplaintWhereInput
    /**
     * Limit how many Complaints to update.
     */
    limit?: number
  }

  /**
   * Complaint updateManyAndReturn
   */
  export type ComplaintUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * The data used to update Complaints.
     */
    data: XOR<ComplaintUpdateManyMutationInput, ComplaintUncheckedUpdateManyInput>
    /**
     * Filter which Complaints to update
     */
    where?: ComplaintWhereInput
    /**
     * Limit how many Complaints to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Complaint upsert
   */
  export type ComplaintUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * The filter to search for the Complaint to update in case it exists.
     */
    where: ComplaintWhereUniqueInput
    /**
     * In case the Complaint found by the `where` argument doesn't exist, create a new Complaint with this data.
     */
    create: XOR<ComplaintCreateInput, ComplaintUncheckedCreateInput>
    /**
     * In case the Complaint was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ComplaintUpdateInput, ComplaintUncheckedUpdateInput>
  }

  /**
   * Complaint delete
   */
  export type ComplaintDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
    /**
     * Filter which Complaint to delete.
     */
    where: ComplaintWhereUniqueInput
  }

  /**
   * Complaint deleteMany
   */
  export type ComplaintDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Complaints to delete
     */
    where?: ComplaintWhereInput
    /**
     * Limit how many Complaints to delete.
     */
    limit?: number
  }

  /**
   * Complaint.assignedTo
   */
  export type Complaint$assignedToArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * Complaint without action
   */
  export type ComplaintDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Complaint
     */
    select?: ComplaintSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Complaint
     */
    omit?: ComplaintOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ComplaintInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    email: 'email',
    password: 'password',
    username: 'username',
    role: 'role',
    approvalStatus: 'approvalStatus',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const StudentProfileScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    enrollmentNumber: 'enrollmentNumber',
    department: 'department',
    branch: 'branch',
    semester: 'semester',
    phoneNumber: 'phoneNumber',
    address: 'address',
    isStudying: 'isStudying',
    guardianName: 'guardianName',
    guardianPhone: 'guardianPhone',
    doubtsAsked: 'doubtsAsked',
    doubtsSolved: 'doubtsSolved',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type StudentProfileScalarFieldEnum = (typeof StudentProfileScalarFieldEnum)[keyof typeof StudentProfileScalarFieldEnum]


  export const FacultyProfileScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    department: 'department',
    branch: 'branch',
    phoneNumber: 'phoneNumber',
    address: 'address',
    isTeaching: 'isTeaching',
    subjects: 'subjects',
    doubtsSolved: 'doubtsSolved',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type FacultyProfileScalarFieldEnum = (typeof FacultyProfileScalarFieldEnum)[keyof typeof FacultyProfileScalarFieldEnum]


  export const AdminProfileScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    adminLevel: 'adminLevel',
    manageUsers: 'manageUsers',
    manageComplaints: 'manageComplaints',
    manageDoubts: 'manageDoubts',
    viewAnalytics: 'viewAnalytics',
    assignedDepartments: 'assignedDepartments',
    allowedCategories: 'allowedCategories',
    complaintsAssigned: 'complaintsAssigned',
    complaintsClosed: 'complaintsClosed',
    usersManaged: 'usersManaged',
    lastLoginAt: 'lastLoginAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AdminProfileScalarFieldEnum = (typeof AdminProfileScalarFieldEnum)[keyof typeof AdminProfileScalarFieldEnum]


  export const DoubtScalarFieldEnum: {
    id: 'id',
    title: 'title',
    description: 'description',
    semester: 'semester',
    subject: 'subject',
    labels: 'labels',
    postedById: 'postedById',
    status: 'status',
    views: 'views',
    upVoteCount: 'upVoteCount',
    answerCount: 'answerCount',
    acceptedAnswerId: 'acceptedAnswerId',
    edited: 'edited',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type DoubtScalarFieldEnum = (typeof DoubtScalarFieldEnum)[keyof typeof DoubtScalarFieldEnum]


  export const AnswerScalarFieldEnum: {
    id: 'id',
    doubtId: 'doubtId',
    content: 'content',
    answeredById: 'answeredById',
    upvotes: 'upvotes',
    isVerified: 'isVerified',
    isAccepted: 'isAccepted',
    edited: 'edited',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AnswerScalarFieldEnum = (typeof AnswerScalarFieldEnum)[keyof typeof AnswerScalarFieldEnum]


  export const ComplaintScalarFieldEnum: {
    id: 'id',
    title: 'title',
    description: 'description',
    category: 'category',
    classroomNumber: 'classroomNumber',
    block: 'block',
    status: 'status',
    priority: 'priority',
    raisedById: 'raisedById',
    assignedToId: 'assignedToId',
    resolutionNote: 'resolutionNote',
    feedbackRating: 'feedbackRating',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ComplaintScalarFieldEnum = (typeof ComplaintScalarFieldEnum)[keyof typeof ComplaintScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Role'
   */
  export type EnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role'>
    


  /**
   * Reference to a field of type 'Role[]'
   */
  export type ListEnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role[]'>
    


  /**
   * Reference to a field of type 'ApprovalStatus'
   */
  export type EnumApprovalStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ApprovalStatus'>
    


  /**
   * Reference to a field of type 'ApprovalStatus[]'
   */
  export type ListEnumApprovalStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ApprovalStatus[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'AdminLevel'
   */
  export type EnumAdminLevelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AdminLevel'>
    


  /**
   * Reference to a field of type 'AdminLevel[]'
   */
  export type ListEnumAdminLevelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AdminLevel[]'>
    


  /**
   * Reference to a field of type 'Subject'
   */
  export type EnumSubjectFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Subject'>
    


  /**
   * Reference to a field of type 'Subject[]'
   */
  export type ListEnumSubjectFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Subject[]'>
    


  /**
   * Reference to a field of type 'DoubtStatus'
   */
  export type EnumDoubtStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DoubtStatus'>
    


  /**
   * Reference to a field of type 'DoubtStatus[]'
   */
  export type ListEnumDoubtStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DoubtStatus[]'>
    


  /**
   * Reference to a field of type 'ComplaintCategory'
   */
  export type EnumComplaintCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ComplaintCategory'>
    


  /**
   * Reference to a field of type 'ComplaintCategory[]'
   */
  export type ListEnumComplaintCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ComplaintCategory[]'>
    


  /**
   * Reference to a field of type 'ComplaintStatus'
   */
  export type EnumComplaintStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ComplaintStatus'>
    


  /**
   * Reference to a field of type 'ComplaintStatus[]'
   */
  export type ListEnumComplaintStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ComplaintStatus[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    name?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    username?: StringFilter<"User"> | string
    role?: EnumRoleFilter<"User"> | $Enums.Role
    approvalStatus?: EnumApprovalStatusFilter<"User"> | $Enums.ApprovalStatus
    isActive?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    studentProfile?: XOR<StudentProfileNullableScalarRelationFilter, StudentProfileWhereInput> | null
    facultyProfile?: XOR<FacultyProfileNullableScalarRelationFilter, FacultyProfileWhereInput> | null
    adminProfile?: XOR<AdminProfileNullableScalarRelationFilter, AdminProfileWhereInput> | null
    doubts?: DoubtListRelationFilter
    answers?: AnswerListRelationFilter
    raisedComplaints?: ComplaintListRelationFilter
    assignedComplaints?: ComplaintListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    approvalStatus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    studentProfile?: StudentProfileOrderByWithRelationInput
    facultyProfile?: FacultyProfileOrderByWithRelationInput
    adminProfile?: AdminProfileOrderByWithRelationInput
    doubts?: DoubtOrderByRelationAggregateInput
    answers?: AnswerOrderByRelationAggregateInput
    raisedComplaints?: ComplaintOrderByRelationAggregateInput
    assignedComplaints?: ComplaintOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    username?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    role?: EnumRoleFilter<"User"> | $Enums.Role
    approvalStatus?: EnumApprovalStatusFilter<"User"> | $Enums.ApprovalStatus
    isActive?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    studentProfile?: XOR<StudentProfileNullableScalarRelationFilter, StudentProfileWhereInput> | null
    facultyProfile?: XOR<FacultyProfileNullableScalarRelationFilter, FacultyProfileWhereInput> | null
    adminProfile?: XOR<AdminProfileNullableScalarRelationFilter, AdminProfileWhereInput> | null
    doubts?: DoubtListRelationFilter
    answers?: AnswerListRelationFilter
    raisedComplaints?: ComplaintListRelationFilter
    assignedComplaints?: ComplaintListRelationFilter
  }, "id" | "email" | "username">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    approvalStatus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    name?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    password?: StringWithAggregatesFilter<"User"> | string
    username?: StringWithAggregatesFilter<"User"> | string
    role?: EnumRoleWithAggregatesFilter<"User"> | $Enums.Role
    approvalStatus?: EnumApprovalStatusWithAggregatesFilter<"User"> | $Enums.ApprovalStatus
    isActive?: BoolWithAggregatesFilter<"User"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type StudentProfileWhereInput = {
    AND?: StudentProfileWhereInput | StudentProfileWhereInput[]
    OR?: StudentProfileWhereInput[]
    NOT?: StudentProfileWhereInput | StudentProfileWhereInput[]
    id?: StringFilter<"StudentProfile"> | string
    userId?: StringFilter<"StudentProfile"> | string
    enrollmentNumber?: StringFilter<"StudentProfile"> | string
    department?: StringFilter<"StudentProfile"> | string
    branch?: StringFilter<"StudentProfile"> | string
    semester?: IntFilter<"StudentProfile"> | number
    phoneNumber?: IntFilter<"StudentProfile"> | number
    address?: StringFilter<"StudentProfile"> | string
    isStudying?: BoolFilter<"StudentProfile"> | boolean
    guardianName?: StringFilter<"StudentProfile"> | string
    guardianPhone?: StringFilter<"StudentProfile"> | string
    doubtsAsked?: IntFilter<"StudentProfile"> | number
    doubtsSolved?: IntFilter<"StudentProfile"> | number
    createdAt?: DateTimeFilter<"StudentProfile"> | Date | string
    updatedAt?: DateTimeFilter<"StudentProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type StudentProfileOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    enrollmentNumber?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    semester?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isStudying?: SortOrder
    guardianName?: SortOrder
    guardianPhone?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type StudentProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    enrollmentNumber?: string
    AND?: StudentProfileWhereInput | StudentProfileWhereInput[]
    OR?: StudentProfileWhereInput[]
    NOT?: StudentProfileWhereInput | StudentProfileWhereInput[]
    department?: StringFilter<"StudentProfile"> | string
    branch?: StringFilter<"StudentProfile"> | string
    semester?: IntFilter<"StudentProfile"> | number
    phoneNumber?: IntFilter<"StudentProfile"> | number
    address?: StringFilter<"StudentProfile"> | string
    isStudying?: BoolFilter<"StudentProfile"> | boolean
    guardianName?: StringFilter<"StudentProfile"> | string
    guardianPhone?: StringFilter<"StudentProfile"> | string
    doubtsAsked?: IntFilter<"StudentProfile"> | number
    doubtsSolved?: IntFilter<"StudentProfile"> | number
    createdAt?: DateTimeFilter<"StudentProfile"> | Date | string
    updatedAt?: DateTimeFilter<"StudentProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "userId" | "enrollmentNumber">

  export type StudentProfileOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    enrollmentNumber?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    semester?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isStudying?: SortOrder
    guardianName?: SortOrder
    guardianPhone?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: StudentProfileCountOrderByAggregateInput
    _avg?: StudentProfileAvgOrderByAggregateInput
    _max?: StudentProfileMaxOrderByAggregateInput
    _min?: StudentProfileMinOrderByAggregateInput
    _sum?: StudentProfileSumOrderByAggregateInput
  }

  export type StudentProfileScalarWhereWithAggregatesInput = {
    AND?: StudentProfileScalarWhereWithAggregatesInput | StudentProfileScalarWhereWithAggregatesInput[]
    OR?: StudentProfileScalarWhereWithAggregatesInput[]
    NOT?: StudentProfileScalarWhereWithAggregatesInput | StudentProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"StudentProfile"> | string
    userId?: StringWithAggregatesFilter<"StudentProfile"> | string
    enrollmentNumber?: StringWithAggregatesFilter<"StudentProfile"> | string
    department?: StringWithAggregatesFilter<"StudentProfile"> | string
    branch?: StringWithAggregatesFilter<"StudentProfile"> | string
    semester?: IntWithAggregatesFilter<"StudentProfile"> | number
    phoneNumber?: IntWithAggregatesFilter<"StudentProfile"> | number
    address?: StringWithAggregatesFilter<"StudentProfile"> | string
    isStudying?: BoolWithAggregatesFilter<"StudentProfile"> | boolean
    guardianName?: StringWithAggregatesFilter<"StudentProfile"> | string
    guardianPhone?: StringWithAggregatesFilter<"StudentProfile"> | string
    doubtsAsked?: IntWithAggregatesFilter<"StudentProfile"> | number
    doubtsSolved?: IntWithAggregatesFilter<"StudentProfile"> | number
    createdAt?: DateTimeWithAggregatesFilter<"StudentProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"StudentProfile"> | Date | string
  }

  export type FacultyProfileWhereInput = {
    AND?: FacultyProfileWhereInput | FacultyProfileWhereInput[]
    OR?: FacultyProfileWhereInput[]
    NOT?: FacultyProfileWhereInput | FacultyProfileWhereInput[]
    id?: StringFilter<"FacultyProfile"> | string
    userId?: StringFilter<"FacultyProfile"> | string
    department?: StringFilter<"FacultyProfile"> | string
    branch?: StringFilter<"FacultyProfile"> | string
    phoneNumber?: StringFilter<"FacultyProfile"> | string
    address?: StringFilter<"FacultyProfile"> | string
    isTeaching?: BoolFilter<"FacultyProfile"> | boolean
    subjects?: StringNullableListFilter<"FacultyProfile">
    doubtsSolved?: IntFilter<"FacultyProfile"> | number
    createdAt?: DateTimeFilter<"FacultyProfile"> | Date | string
    updatedAt?: DateTimeFilter<"FacultyProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type FacultyProfileOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isTeaching?: SortOrder
    subjects?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type FacultyProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    AND?: FacultyProfileWhereInput | FacultyProfileWhereInput[]
    OR?: FacultyProfileWhereInput[]
    NOT?: FacultyProfileWhereInput | FacultyProfileWhereInput[]
    department?: StringFilter<"FacultyProfile"> | string
    branch?: StringFilter<"FacultyProfile"> | string
    phoneNumber?: StringFilter<"FacultyProfile"> | string
    address?: StringFilter<"FacultyProfile"> | string
    isTeaching?: BoolFilter<"FacultyProfile"> | boolean
    subjects?: StringNullableListFilter<"FacultyProfile">
    doubtsSolved?: IntFilter<"FacultyProfile"> | number
    createdAt?: DateTimeFilter<"FacultyProfile"> | Date | string
    updatedAt?: DateTimeFilter<"FacultyProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "userId">

  export type FacultyProfileOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isTeaching?: SortOrder
    subjects?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: FacultyProfileCountOrderByAggregateInput
    _avg?: FacultyProfileAvgOrderByAggregateInput
    _max?: FacultyProfileMaxOrderByAggregateInput
    _min?: FacultyProfileMinOrderByAggregateInput
    _sum?: FacultyProfileSumOrderByAggregateInput
  }

  export type FacultyProfileScalarWhereWithAggregatesInput = {
    AND?: FacultyProfileScalarWhereWithAggregatesInput | FacultyProfileScalarWhereWithAggregatesInput[]
    OR?: FacultyProfileScalarWhereWithAggregatesInput[]
    NOT?: FacultyProfileScalarWhereWithAggregatesInput | FacultyProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"FacultyProfile"> | string
    userId?: StringWithAggregatesFilter<"FacultyProfile"> | string
    department?: StringWithAggregatesFilter<"FacultyProfile"> | string
    branch?: StringWithAggregatesFilter<"FacultyProfile"> | string
    phoneNumber?: StringWithAggregatesFilter<"FacultyProfile"> | string
    address?: StringWithAggregatesFilter<"FacultyProfile"> | string
    isTeaching?: BoolWithAggregatesFilter<"FacultyProfile"> | boolean
    subjects?: StringNullableListFilter<"FacultyProfile">
    doubtsSolved?: IntWithAggregatesFilter<"FacultyProfile"> | number
    createdAt?: DateTimeWithAggregatesFilter<"FacultyProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"FacultyProfile"> | Date | string
  }

  export type AdminProfileWhereInput = {
    AND?: AdminProfileWhereInput | AdminProfileWhereInput[]
    OR?: AdminProfileWhereInput[]
    NOT?: AdminProfileWhereInput | AdminProfileWhereInput[]
    id?: StringFilter<"AdminProfile"> | string
    userId?: StringFilter<"AdminProfile"> | string
    adminLevel?: EnumAdminLevelFilter<"AdminProfile"> | $Enums.AdminLevel
    manageUsers?: BoolFilter<"AdminProfile"> | boolean
    manageComplaints?: BoolFilter<"AdminProfile"> | boolean
    manageDoubts?: BoolFilter<"AdminProfile"> | boolean
    viewAnalytics?: BoolFilter<"AdminProfile"> | boolean
    assignedDepartments?: StringNullableListFilter<"AdminProfile">
    allowedCategories?: StringNullableListFilter<"AdminProfile">
    complaintsAssigned?: IntFilter<"AdminProfile"> | number
    complaintsClosed?: IntFilter<"AdminProfile"> | number
    usersManaged?: IntFilter<"AdminProfile"> | number
    lastLoginAt?: DateTimeNullableFilter<"AdminProfile"> | Date | string | null
    createdAt?: DateTimeFilter<"AdminProfile"> | Date | string
    updatedAt?: DateTimeFilter<"AdminProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type AdminProfileOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    adminLevel?: SortOrder
    manageUsers?: SortOrder
    manageComplaints?: SortOrder
    manageDoubts?: SortOrder
    viewAnalytics?: SortOrder
    assignedDepartments?: SortOrder
    allowedCategories?: SortOrder
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
    lastLoginAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type AdminProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    AND?: AdminProfileWhereInput | AdminProfileWhereInput[]
    OR?: AdminProfileWhereInput[]
    NOT?: AdminProfileWhereInput | AdminProfileWhereInput[]
    adminLevel?: EnumAdminLevelFilter<"AdminProfile"> | $Enums.AdminLevel
    manageUsers?: BoolFilter<"AdminProfile"> | boolean
    manageComplaints?: BoolFilter<"AdminProfile"> | boolean
    manageDoubts?: BoolFilter<"AdminProfile"> | boolean
    viewAnalytics?: BoolFilter<"AdminProfile"> | boolean
    assignedDepartments?: StringNullableListFilter<"AdminProfile">
    allowedCategories?: StringNullableListFilter<"AdminProfile">
    complaintsAssigned?: IntFilter<"AdminProfile"> | number
    complaintsClosed?: IntFilter<"AdminProfile"> | number
    usersManaged?: IntFilter<"AdminProfile"> | number
    lastLoginAt?: DateTimeNullableFilter<"AdminProfile"> | Date | string | null
    createdAt?: DateTimeFilter<"AdminProfile"> | Date | string
    updatedAt?: DateTimeFilter<"AdminProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "userId">

  export type AdminProfileOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    adminLevel?: SortOrder
    manageUsers?: SortOrder
    manageComplaints?: SortOrder
    manageDoubts?: SortOrder
    viewAnalytics?: SortOrder
    assignedDepartments?: SortOrder
    allowedCategories?: SortOrder
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
    lastLoginAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AdminProfileCountOrderByAggregateInput
    _avg?: AdminProfileAvgOrderByAggregateInput
    _max?: AdminProfileMaxOrderByAggregateInput
    _min?: AdminProfileMinOrderByAggregateInput
    _sum?: AdminProfileSumOrderByAggregateInput
  }

  export type AdminProfileScalarWhereWithAggregatesInput = {
    AND?: AdminProfileScalarWhereWithAggregatesInput | AdminProfileScalarWhereWithAggregatesInput[]
    OR?: AdminProfileScalarWhereWithAggregatesInput[]
    NOT?: AdminProfileScalarWhereWithAggregatesInput | AdminProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AdminProfile"> | string
    userId?: StringWithAggregatesFilter<"AdminProfile"> | string
    adminLevel?: EnumAdminLevelWithAggregatesFilter<"AdminProfile"> | $Enums.AdminLevel
    manageUsers?: BoolWithAggregatesFilter<"AdminProfile"> | boolean
    manageComplaints?: BoolWithAggregatesFilter<"AdminProfile"> | boolean
    manageDoubts?: BoolWithAggregatesFilter<"AdminProfile"> | boolean
    viewAnalytics?: BoolWithAggregatesFilter<"AdminProfile"> | boolean
    assignedDepartments?: StringNullableListFilter<"AdminProfile">
    allowedCategories?: StringNullableListFilter<"AdminProfile">
    complaintsAssigned?: IntWithAggregatesFilter<"AdminProfile"> | number
    complaintsClosed?: IntWithAggregatesFilter<"AdminProfile"> | number
    usersManaged?: IntWithAggregatesFilter<"AdminProfile"> | number
    lastLoginAt?: DateTimeNullableWithAggregatesFilter<"AdminProfile"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"AdminProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AdminProfile"> | Date | string
  }

  export type DoubtWhereInput = {
    AND?: DoubtWhereInput | DoubtWhereInput[]
    OR?: DoubtWhereInput[]
    NOT?: DoubtWhereInput | DoubtWhereInput[]
    id?: StringFilter<"Doubt"> | string
    title?: StringFilter<"Doubt"> | string
    description?: StringFilter<"Doubt"> | string
    semester?: IntFilter<"Doubt"> | number
    subject?: EnumSubjectFilter<"Doubt"> | $Enums.Subject
    labels?: StringNullableListFilter<"Doubt">
    postedById?: StringFilter<"Doubt"> | string
    status?: EnumDoubtStatusFilter<"Doubt"> | $Enums.DoubtStatus
    views?: IntFilter<"Doubt"> | number
    upVoteCount?: IntFilter<"Doubt"> | number
    answerCount?: IntFilter<"Doubt"> | number
    acceptedAnswerId?: StringNullableFilter<"Doubt"> | string | null
    edited?: BoolFilter<"Doubt"> | boolean
    createdAt?: DateTimeFilter<"Doubt"> | Date | string
    updatedAt?: DateTimeFilter<"Doubt"> | Date | string
    postedBy?: XOR<UserScalarRelationFilter, UserWhereInput>
    answers?: AnswerListRelationFilter
  }

  export type DoubtOrderByWithRelationInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    semester?: SortOrder
    subject?: SortOrder
    labels?: SortOrder
    postedById?: SortOrder
    status?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
    acceptedAnswerId?: SortOrderInput | SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    postedBy?: UserOrderByWithRelationInput
    answers?: AnswerOrderByRelationAggregateInput
  }

  export type DoubtWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: DoubtWhereInput | DoubtWhereInput[]
    OR?: DoubtWhereInput[]
    NOT?: DoubtWhereInput | DoubtWhereInput[]
    title?: StringFilter<"Doubt"> | string
    description?: StringFilter<"Doubt"> | string
    semester?: IntFilter<"Doubt"> | number
    subject?: EnumSubjectFilter<"Doubt"> | $Enums.Subject
    labels?: StringNullableListFilter<"Doubt">
    postedById?: StringFilter<"Doubt"> | string
    status?: EnumDoubtStatusFilter<"Doubt"> | $Enums.DoubtStatus
    views?: IntFilter<"Doubt"> | number
    upVoteCount?: IntFilter<"Doubt"> | number
    answerCount?: IntFilter<"Doubt"> | number
    acceptedAnswerId?: StringNullableFilter<"Doubt"> | string | null
    edited?: BoolFilter<"Doubt"> | boolean
    createdAt?: DateTimeFilter<"Doubt"> | Date | string
    updatedAt?: DateTimeFilter<"Doubt"> | Date | string
    postedBy?: XOR<UserScalarRelationFilter, UserWhereInput>
    answers?: AnswerListRelationFilter
  }, "id">

  export type DoubtOrderByWithAggregationInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    semester?: SortOrder
    subject?: SortOrder
    labels?: SortOrder
    postedById?: SortOrder
    status?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
    acceptedAnswerId?: SortOrderInput | SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: DoubtCountOrderByAggregateInput
    _avg?: DoubtAvgOrderByAggregateInput
    _max?: DoubtMaxOrderByAggregateInput
    _min?: DoubtMinOrderByAggregateInput
    _sum?: DoubtSumOrderByAggregateInput
  }

  export type DoubtScalarWhereWithAggregatesInput = {
    AND?: DoubtScalarWhereWithAggregatesInput | DoubtScalarWhereWithAggregatesInput[]
    OR?: DoubtScalarWhereWithAggregatesInput[]
    NOT?: DoubtScalarWhereWithAggregatesInput | DoubtScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Doubt"> | string
    title?: StringWithAggregatesFilter<"Doubt"> | string
    description?: StringWithAggregatesFilter<"Doubt"> | string
    semester?: IntWithAggregatesFilter<"Doubt"> | number
    subject?: EnumSubjectWithAggregatesFilter<"Doubt"> | $Enums.Subject
    labels?: StringNullableListFilter<"Doubt">
    postedById?: StringWithAggregatesFilter<"Doubt"> | string
    status?: EnumDoubtStatusWithAggregatesFilter<"Doubt"> | $Enums.DoubtStatus
    views?: IntWithAggregatesFilter<"Doubt"> | number
    upVoteCount?: IntWithAggregatesFilter<"Doubt"> | number
    answerCount?: IntWithAggregatesFilter<"Doubt"> | number
    acceptedAnswerId?: StringNullableWithAggregatesFilter<"Doubt"> | string | null
    edited?: BoolWithAggregatesFilter<"Doubt"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Doubt"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Doubt"> | Date | string
  }

  export type AnswerWhereInput = {
    AND?: AnswerWhereInput | AnswerWhereInput[]
    OR?: AnswerWhereInput[]
    NOT?: AnswerWhereInput | AnswerWhereInput[]
    id?: StringFilter<"Answer"> | string
    doubtId?: StringFilter<"Answer"> | string
    content?: StringFilter<"Answer"> | string
    answeredById?: StringFilter<"Answer"> | string
    upvotes?: IntFilter<"Answer"> | number
    isVerified?: BoolFilter<"Answer"> | boolean
    isAccepted?: BoolFilter<"Answer"> | boolean
    edited?: BoolFilter<"Answer"> | boolean
    createdAt?: DateTimeFilter<"Answer"> | Date | string
    updatedAt?: DateTimeFilter<"Answer"> | Date | string
    doubt?: XOR<DoubtScalarRelationFilter, DoubtWhereInput>
    answeredBy?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type AnswerOrderByWithRelationInput = {
    id?: SortOrder
    doubtId?: SortOrder
    content?: SortOrder
    answeredById?: SortOrder
    upvotes?: SortOrder
    isVerified?: SortOrder
    isAccepted?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    doubt?: DoubtOrderByWithRelationInput
    answeredBy?: UserOrderByWithRelationInput
  }

  export type AnswerWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AnswerWhereInput | AnswerWhereInput[]
    OR?: AnswerWhereInput[]
    NOT?: AnswerWhereInput | AnswerWhereInput[]
    doubtId?: StringFilter<"Answer"> | string
    content?: StringFilter<"Answer"> | string
    answeredById?: StringFilter<"Answer"> | string
    upvotes?: IntFilter<"Answer"> | number
    isVerified?: BoolFilter<"Answer"> | boolean
    isAccepted?: BoolFilter<"Answer"> | boolean
    edited?: BoolFilter<"Answer"> | boolean
    createdAt?: DateTimeFilter<"Answer"> | Date | string
    updatedAt?: DateTimeFilter<"Answer"> | Date | string
    doubt?: XOR<DoubtScalarRelationFilter, DoubtWhereInput>
    answeredBy?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type AnswerOrderByWithAggregationInput = {
    id?: SortOrder
    doubtId?: SortOrder
    content?: SortOrder
    answeredById?: SortOrder
    upvotes?: SortOrder
    isVerified?: SortOrder
    isAccepted?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AnswerCountOrderByAggregateInput
    _avg?: AnswerAvgOrderByAggregateInput
    _max?: AnswerMaxOrderByAggregateInput
    _min?: AnswerMinOrderByAggregateInput
    _sum?: AnswerSumOrderByAggregateInput
  }

  export type AnswerScalarWhereWithAggregatesInput = {
    AND?: AnswerScalarWhereWithAggregatesInput | AnswerScalarWhereWithAggregatesInput[]
    OR?: AnswerScalarWhereWithAggregatesInput[]
    NOT?: AnswerScalarWhereWithAggregatesInput | AnswerScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Answer"> | string
    doubtId?: StringWithAggregatesFilter<"Answer"> | string
    content?: StringWithAggregatesFilter<"Answer"> | string
    answeredById?: StringWithAggregatesFilter<"Answer"> | string
    upvotes?: IntWithAggregatesFilter<"Answer"> | number
    isVerified?: BoolWithAggregatesFilter<"Answer"> | boolean
    isAccepted?: BoolWithAggregatesFilter<"Answer"> | boolean
    edited?: BoolWithAggregatesFilter<"Answer"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Answer"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Answer"> | Date | string
  }

  export type ComplaintWhereInput = {
    AND?: ComplaintWhereInput | ComplaintWhereInput[]
    OR?: ComplaintWhereInput[]
    NOT?: ComplaintWhereInput | ComplaintWhereInput[]
    id?: StringFilter<"Complaint"> | string
    title?: StringFilter<"Complaint"> | string
    description?: StringFilter<"Complaint"> | string
    category?: EnumComplaintCategoryFilter<"Complaint"> | $Enums.ComplaintCategory
    classroomNumber?: StringFilter<"Complaint"> | string
    block?: StringFilter<"Complaint"> | string
    status?: EnumComplaintStatusFilter<"Complaint"> | $Enums.ComplaintStatus
    priority?: IntFilter<"Complaint"> | number
    raisedById?: StringFilter<"Complaint"> | string
    assignedToId?: StringNullableFilter<"Complaint"> | string | null
    resolutionNote?: StringNullableFilter<"Complaint"> | string | null
    feedbackRating?: IntNullableFilter<"Complaint"> | number | null
    createdAt?: DateTimeFilter<"Complaint"> | Date | string
    updatedAt?: DateTimeFilter<"Complaint"> | Date | string
    raisedBy?: XOR<UserScalarRelationFilter, UserWhereInput>
    assignedTo?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type ComplaintOrderByWithRelationInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    classroomNumber?: SortOrder
    block?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    raisedById?: SortOrder
    assignedToId?: SortOrderInput | SortOrder
    resolutionNote?: SortOrderInput | SortOrder
    feedbackRating?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    raisedBy?: UserOrderByWithRelationInput
    assignedTo?: UserOrderByWithRelationInput
  }

  export type ComplaintWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ComplaintWhereInput | ComplaintWhereInput[]
    OR?: ComplaintWhereInput[]
    NOT?: ComplaintWhereInput | ComplaintWhereInput[]
    title?: StringFilter<"Complaint"> | string
    description?: StringFilter<"Complaint"> | string
    category?: EnumComplaintCategoryFilter<"Complaint"> | $Enums.ComplaintCategory
    classroomNumber?: StringFilter<"Complaint"> | string
    block?: StringFilter<"Complaint"> | string
    status?: EnumComplaintStatusFilter<"Complaint"> | $Enums.ComplaintStatus
    priority?: IntFilter<"Complaint"> | number
    raisedById?: StringFilter<"Complaint"> | string
    assignedToId?: StringNullableFilter<"Complaint"> | string | null
    resolutionNote?: StringNullableFilter<"Complaint"> | string | null
    feedbackRating?: IntNullableFilter<"Complaint"> | number | null
    createdAt?: DateTimeFilter<"Complaint"> | Date | string
    updatedAt?: DateTimeFilter<"Complaint"> | Date | string
    raisedBy?: XOR<UserScalarRelationFilter, UserWhereInput>
    assignedTo?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id">

  export type ComplaintOrderByWithAggregationInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    classroomNumber?: SortOrder
    block?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    raisedById?: SortOrder
    assignedToId?: SortOrderInput | SortOrder
    resolutionNote?: SortOrderInput | SortOrder
    feedbackRating?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ComplaintCountOrderByAggregateInput
    _avg?: ComplaintAvgOrderByAggregateInput
    _max?: ComplaintMaxOrderByAggregateInput
    _min?: ComplaintMinOrderByAggregateInput
    _sum?: ComplaintSumOrderByAggregateInput
  }

  export type ComplaintScalarWhereWithAggregatesInput = {
    AND?: ComplaintScalarWhereWithAggregatesInput | ComplaintScalarWhereWithAggregatesInput[]
    OR?: ComplaintScalarWhereWithAggregatesInput[]
    NOT?: ComplaintScalarWhereWithAggregatesInput | ComplaintScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Complaint"> | string
    title?: StringWithAggregatesFilter<"Complaint"> | string
    description?: StringWithAggregatesFilter<"Complaint"> | string
    category?: EnumComplaintCategoryWithAggregatesFilter<"Complaint"> | $Enums.ComplaintCategory
    classroomNumber?: StringWithAggregatesFilter<"Complaint"> | string
    block?: StringWithAggregatesFilter<"Complaint"> | string
    status?: EnumComplaintStatusWithAggregatesFilter<"Complaint"> | $Enums.ComplaintStatus
    priority?: IntWithAggregatesFilter<"Complaint"> | number
    raisedById?: StringWithAggregatesFilter<"Complaint"> | string
    assignedToId?: StringNullableWithAggregatesFilter<"Complaint"> | string | null
    resolutionNote?: StringNullableWithAggregatesFilter<"Complaint"> | string | null
    feedbackRating?: IntNullableWithAggregatesFilter<"Complaint"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"Complaint"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Complaint"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StudentProfileCreateInput = {
    id?: string
    enrollmentNumber: string
    department: string
    branch: string
    semester: number
    phoneNumber: number
    address: string
    isStudying?: boolean
    guardianName: string
    guardianPhone: string
    doubtsAsked?: number
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutStudentProfileInput
  }

  export type StudentProfileUncheckedCreateInput = {
    id?: string
    userId: string
    enrollmentNumber: string
    department: string
    branch: string
    semester: number
    phoneNumber: number
    address: string
    isStudying?: boolean
    guardianName: string
    guardianPhone: string
    doubtsAsked?: number
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StudentProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    enrollmentNumber?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    phoneNumber?: IntFieldUpdateOperationsInput | number
    address?: StringFieldUpdateOperationsInput | string
    isStudying?: BoolFieldUpdateOperationsInput | boolean
    guardianName?: StringFieldUpdateOperationsInput | string
    guardianPhone?: StringFieldUpdateOperationsInput | string
    doubtsAsked?: IntFieldUpdateOperationsInput | number
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutStudentProfileNestedInput
  }

  export type StudentProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    enrollmentNumber?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    phoneNumber?: IntFieldUpdateOperationsInput | number
    address?: StringFieldUpdateOperationsInput | string
    isStudying?: BoolFieldUpdateOperationsInput | boolean
    guardianName?: StringFieldUpdateOperationsInput | string
    guardianPhone?: StringFieldUpdateOperationsInput | string
    doubtsAsked?: IntFieldUpdateOperationsInput | number
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StudentProfileCreateManyInput = {
    id?: string
    userId: string
    enrollmentNumber: string
    department: string
    branch: string
    semester: number
    phoneNumber: number
    address: string
    isStudying?: boolean
    guardianName: string
    guardianPhone: string
    doubtsAsked?: number
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StudentProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    enrollmentNumber?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    phoneNumber?: IntFieldUpdateOperationsInput | number
    address?: StringFieldUpdateOperationsInput | string
    isStudying?: BoolFieldUpdateOperationsInput | boolean
    guardianName?: StringFieldUpdateOperationsInput | string
    guardianPhone?: StringFieldUpdateOperationsInput | string
    doubtsAsked?: IntFieldUpdateOperationsInput | number
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StudentProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    enrollmentNumber?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    phoneNumber?: IntFieldUpdateOperationsInput | number
    address?: StringFieldUpdateOperationsInput | string
    isStudying?: BoolFieldUpdateOperationsInput | boolean
    guardianName?: StringFieldUpdateOperationsInput | string
    guardianPhone?: StringFieldUpdateOperationsInput | string
    doubtsAsked?: IntFieldUpdateOperationsInput | number
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FacultyProfileCreateInput = {
    id?: string
    department: string
    branch: string
    phoneNumber: string
    address: string
    isTeaching?: boolean
    subjects?: FacultyProfileCreatesubjectsInput | string[]
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutFacultyProfileInput
  }

  export type FacultyProfileUncheckedCreateInput = {
    id?: string
    userId: string
    department: string
    branch: string
    phoneNumber: string
    address: string
    isTeaching?: boolean
    subjects?: FacultyProfileCreatesubjectsInput | string[]
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type FacultyProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    phoneNumber?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isTeaching?: BoolFieldUpdateOperationsInput | boolean
    subjects?: FacultyProfileUpdatesubjectsInput | string[]
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutFacultyProfileNestedInput
  }

  export type FacultyProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    phoneNumber?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isTeaching?: BoolFieldUpdateOperationsInput | boolean
    subjects?: FacultyProfileUpdatesubjectsInput | string[]
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FacultyProfileCreateManyInput = {
    id?: string
    userId: string
    department: string
    branch: string
    phoneNumber: string
    address: string
    isTeaching?: boolean
    subjects?: FacultyProfileCreatesubjectsInput | string[]
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type FacultyProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    phoneNumber?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isTeaching?: BoolFieldUpdateOperationsInput | boolean
    subjects?: FacultyProfileUpdatesubjectsInput | string[]
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FacultyProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    phoneNumber?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isTeaching?: BoolFieldUpdateOperationsInput | boolean
    subjects?: FacultyProfileUpdatesubjectsInput | string[]
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminProfileCreateInput = {
    id?: string
    adminLevel: $Enums.AdminLevel
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: AdminProfileCreateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileCreateallowedCategoriesInput | string[]
    complaintsAssigned?: number
    complaintsClosed?: number
    usersManaged?: number
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutAdminProfileInput
  }

  export type AdminProfileUncheckedCreateInput = {
    id?: string
    userId: string
    adminLevel: $Enums.AdminLevel
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: AdminProfileCreateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileCreateallowedCategoriesInput | string[]
    complaintsAssigned?: number
    complaintsClosed?: number
    usersManaged?: number
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AdminProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminLevel?: EnumAdminLevelFieldUpdateOperationsInput | $Enums.AdminLevel
    manageUsers?: BoolFieldUpdateOperationsInput | boolean
    manageComplaints?: BoolFieldUpdateOperationsInput | boolean
    manageDoubts?: BoolFieldUpdateOperationsInput | boolean
    viewAnalytics?: BoolFieldUpdateOperationsInput | boolean
    assignedDepartments?: AdminProfileUpdateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileUpdateallowedCategoriesInput | string[]
    complaintsAssigned?: IntFieldUpdateOperationsInput | number
    complaintsClosed?: IntFieldUpdateOperationsInput | number
    usersManaged?: IntFieldUpdateOperationsInput | number
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutAdminProfileNestedInput
  }

  export type AdminProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    adminLevel?: EnumAdminLevelFieldUpdateOperationsInput | $Enums.AdminLevel
    manageUsers?: BoolFieldUpdateOperationsInput | boolean
    manageComplaints?: BoolFieldUpdateOperationsInput | boolean
    manageDoubts?: BoolFieldUpdateOperationsInput | boolean
    viewAnalytics?: BoolFieldUpdateOperationsInput | boolean
    assignedDepartments?: AdminProfileUpdateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileUpdateallowedCategoriesInput | string[]
    complaintsAssigned?: IntFieldUpdateOperationsInput | number
    complaintsClosed?: IntFieldUpdateOperationsInput | number
    usersManaged?: IntFieldUpdateOperationsInput | number
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminProfileCreateManyInput = {
    id?: string
    userId: string
    adminLevel: $Enums.AdminLevel
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: AdminProfileCreateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileCreateallowedCategoriesInput | string[]
    complaintsAssigned?: number
    complaintsClosed?: number
    usersManaged?: number
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AdminProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminLevel?: EnumAdminLevelFieldUpdateOperationsInput | $Enums.AdminLevel
    manageUsers?: BoolFieldUpdateOperationsInput | boolean
    manageComplaints?: BoolFieldUpdateOperationsInput | boolean
    manageDoubts?: BoolFieldUpdateOperationsInput | boolean
    viewAnalytics?: BoolFieldUpdateOperationsInput | boolean
    assignedDepartments?: AdminProfileUpdateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileUpdateallowedCategoriesInput | string[]
    complaintsAssigned?: IntFieldUpdateOperationsInput | number
    complaintsClosed?: IntFieldUpdateOperationsInput | number
    usersManaged?: IntFieldUpdateOperationsInput | number
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    adminLevel?: EnumAdminLevelFieldUpdateOperationsInput | $Enums.AdminLevel
    manageUsers?: BoolFieldUpdateOperationsInput | boolean
    manageComplaints?: BoolFieldUpdateOperationsInput | boolean
    manageDoubts?: BoolFieldUpdateOperationsInput | boolean
    viewAnalytics?: BoolFieldUpdateOperationsInput | boolean
    assignedDepartments?: AdminProfileUpdateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileUpdateallowedCategoriesInput | string[]
    complaintsAssigned?: IntFieldUpdateOperationsInput | number
    complaintsClosed?: IntFieldUpdateOperationsInput | number
    usersManaged?: IntFieldUpdateOperationsInput | number
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DoubtCreateInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    postedBy: UserCreateNestedOneWithoutDoubtsInput
    answers?: AnswerCreateNestedManyWithoutDoubtInput
  }

  export type DoubtUncheckedCreateInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    postedById: string
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    answers?: AnswerUncheckedCreateNestedManyWithoutDoubtInput
  }

  export type DoubtUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    postedBy?: UserUpdateOneRequiredWithoutDoubtsNestedInput
    answers?: AnswerUpdateManyWithoutDoubtNestedInput
  }

  export type DoubtUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    postedById?: StringFieldUpdateOperationsInput | string
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    answers?: AnswerUncheckedUpdateManyWithoutDoubtNestedInput
  }

  export type DoubtCreateManyInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    postedById: string
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DoubtUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DoubtUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    postedById?: StringFieldUpdateOperationsInput | string
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerCreateInput = {
    id?: string
    content: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    doubt: DoubtCreateNestedOneWithoutAnswersInput
    answeredBy: UserCreateNestedOneWithoutAnswersInput
  }

  export type AnswerUncheckedCreateInput = {
    id?: string
    doubtId: string
    content: string
    answeredById: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnswerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    doubt?: DoubtUpdateOneRequiredWithoutAnswersNestedInput
    answeredBy?: UserUpdateOneRequiredWithoutAnswersNestedInput
  }

  export type AnswerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    doubtId?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    answeredById?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerCreateManyInput = {
    id?: string
    doubtId: string
    content: string
    answeredById: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnswerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    doubtId?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    answeredById?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintCreateInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    raisedBy: UserCreateNestedOneWithoutRaisedComplaintsInput
    assignedTo?: UserCreateNestedOneWithoutAssignedComplaintsInput
  }

  export type ComplaintUncheckedCreateInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    raisedById: string
    assignedToId?: string | null
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComplaintUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    raisedBy?: UserUpdateOneRequiredWithoutRaisedComplaintsNestedInput
    assignedTo?: UserUpdateOneWithoutAssignedComplaintsNestedInput
  }

  export type ComplaintUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    raisedById?: StringFieldUpdateOperationsInput | string
    assignedToId?: NullableStringFieldUpdateOperationsInput | string | null
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintCreateManyInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    raisedById: string
    assignedToId?: string | null
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComplaintUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    raisedById?: StringFieldUpdateOperationsInput | string
    assignedToId?: NullableStringFieldUpdateOperationsInput | string | null
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type EnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role
  }

  export type EnumApprovalStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.ApprovalStatus | EnumApprovalStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumApprovalStatusFilter<$PrismaModel> | $Enums.ApprovalStatus
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type StudentProfileNullableScalarRelationFilter = {
    is?: StudentProfileWhereInput | null
    isNot?: StudentProfileWhereInput | null
  }

  export type FacultyProfileNullableScalarRelationFilter = {
    is?: FacultyProfileWhereInput | null
    isNot?: FacultyProfileWhereInput | null
  }

  export type AdminProfileNullableScalarRelationFilter = {
    is?: AdminProfileWhereInput | null
    isNot?: AdminProfileWhereInput | null
  }

  export type DoubtListRelationFilter = {
    every?: DoubtWhereInput
    some?: DoubtWhereInput
    none?: DoubtWhereInput
  }

  export type AnswerListRelationFilter = {
    every?: AnswerWhereInput
    some?: AnswerWhereInput
    none?: AnswerWhereInput
  }

  export type ComplaintListRelationFilter = {
    every?: ComplaintWhereInput
    some?: ComplaintWhereInput
    none?: ComplaintWhereInput
  }

  export type DoubtOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AnswerOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ComplaintOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    approvalStatus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    approvalStatus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    username?: SortOrder
    role?: SortOrder
    approvalStatus?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type EnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type EnumApprovalStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ApprovalStatus | EnumApprovalStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumApprovalStatusWithAggregatesFilter<$PrismaModel> | $Enums.ApprovalStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumApprovalStatusFilter<$PrismaModel>
    _max?: NestedEnumApprovalStatusFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type StudentProfileCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    enrollmentNumber?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    semester?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isStudying?: SortOrder
    guardianName?: SortOrder
    guardianPhone?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StudentProfileAvgOrderByAggregateInput = {
    semester?: SortOrder
    phoneNumber?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
  }

  export type StudentProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    enrollmentNumber?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    semester?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isStudying?: SortOrder
    guardianName?: SortOrder
    guardianPhone?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StudentProfileMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    enrollmentNumber?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    semester?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isStudying?: SortOrder
    guardianName?: SortOrder
    guardianPhone?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StudentProfileSumOrderByAggregateInput = {
    semester?: SortOrder
    phoneNumber?: SortOrder
    doubtsAsked?: SortOrder
    doubtsSolved?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type FacultyProfileCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isTeaching?: SortOrder
    subjects?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type FacultyProfileAvgOrderByAggregateInput = {
    doubtsSolved?: SortOrder
  }

  export type FacultyProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isTeaching?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type FacultyProfileMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    department?: SortOrder
    branch?: SortOrder
    phoneNumber?: SortOrder
    address?: SortOrder
    isTeaching?: SortOrder
    doubtsSolved?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type FacultyProfileSumOrderByAggregateInput = {
    doubtsSolved?: SortOrder
  }

  export type EnumAdminLevelFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminLevel | EnumAdminLevelFieldRefInput<$PrismaModel>
    in?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminLevelFilter<$PrismaModel> | $Enums.AdminLevel
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type AdminProfileCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    adminLevel?: SortOrder
    manageUsers?: SortOrder
    manageComplaints?: SortOrder
    manageDoubts?: SortOrder
    viewAnalytics?: SortOrder
    assignedDepartments?: SortOrder
    allowedCategories?: SortOrder
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
    lastLoginAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AdminProfileAvgOrderByAggregateInput = {
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
  }

  export type AdminProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    adminLevel?: SortOrder
    manageUsers?: SortOrder
    manageComplaints?: SortOrder
    manageDoubts?: SortOrder
    viewAnalytics?: SortOrder
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
    lastLoginAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AdminProfileMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    adminLevel?: SortOrder
    manageUsers?: SortOrder
    manageComplaints?: SortOrder
    manageDoubts?: SortOrder
    viewAnalytics?: SortOrder
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
    lastLoginAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AdminProfileSumOrderByAggregateInput = {
    complaintsAssigned?: SortOrder
    complaintsClosed?: SortOrder
    usersManaged?: SortOrder
  }

  export type EnumAdminLevelWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminLevel | EnumAdminLevelFieldRefInput<$PrismaModel>
    in?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminLevelWithAggregatesFilter<$PrismaModel> | $Enums.AdminLevel
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAdminLevelFilter<$PrismaModel>
    _max?: NestedEnumAdminLevelFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumSubjectFilter<$PrismaModel = never> = {
    equals?: $Enums.Subject | EnumSubjectFieldRefInput<$PrismaModel>
    in?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    notIn?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    not?: NestedEnumSubjectFilter<$PrismaModel> | $Enums.Subject
  }

  export type EnumDoubtStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.DoubtStatus | EnumDoubtStatusFieldRefInput<$PrismaModel>
    in?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumDoubtStatusFilter<$PrismaModel> | $Enums.DoubtStatus
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DoubtCountOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    semester?: SortOrder
    subject?: SortOrder
    labels?: SortOrder
    postedById?: SortOrder
    status?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
    acceptedAnswerId?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DoubtAvgOrderByAggregateInput = {
    semester?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
  }

  export type DoubtMaxOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    semester?: SortOrder
    subject?: SortOrder
    postedById?: SortOrder
    status?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
    acceptedAnswerId?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DoubtMinOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    semester?: SortOrder
    subject?: SortOrder
    postedById?: SortOrder
    status?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
    acceptedAnswerId?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DoubtSumOrderByAggregateInput = {
    semester?: SortOrder
    views?: SortOrder
    upVoteCount?: SortOrder
    answerCount?: SortOrder
  }

  export type EnumSubjectWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Subject | EnumSubjectFieldRefInput<$PrismaModel>
    in?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    notIn?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    not?: NestedEnumSubjectWithAggregatesFilter<$PrismaModel> | $Enums.Subject
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubjectFilter<$PrismaModel>
    _max?: NestedEnumSubjectFilter<$PrismaModel>
  }

  export type EnumDoubtStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.DoubtStatus | EnumDoubtStatusFieldRefInput<$PrismaModel>
    in?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumDoubtStatusWithAggregatesFilter<$PrismaModel> | $Enums.DoubtStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumDoubtStatusFilter<$PrismaModel>
    _max?: NestedEnumDoubtStatusFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DoubtScalarRelationFilter = {
    is?: DoubtWhereInput
    isNot?: DoubtWhereInput
  }

  export type AnswerCountOrderByAggregateInput = {
    id?: SortOrder
    doubtId?: SortOrder
    content?: SortOrder
    answeredById?: SortOrder
    upvotes?: SortOrder
    isVerified?: SortOrder
    isAccepted?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnswerAvgOrderByAggregateInput = {
    upvotes?: SortOrder
  }

  export type AnswerMaxOrderByAggregateInput = {
    id?: SortOrder
    doubtId?: SortOrder
    content?: SortOrder
    answeredById?: SortOrder
    upvotes?: SortOrder
    isVerified?: SortOrder
    isAccepted?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnswerMinOrderByAggregateInput = {
    id?: SortOrder
    doubtId?: SortOrder
    content?: SortOrder
    answeredById?: SortOrder
    upvotes?: SortOrder
    isVerified?: SortOrder
    isAccepted?: SortOrder
    edited?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AnswerSumOrderByAggregateInput = {
    upvotes?: SortOrder
  }

  export type EnumComplaintCategoryFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintCategory | EnumComplaintCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintCategoryFilter<$PrismaModel> | $Enums.ComplaintCategory
  }

  export type EnumComplaintStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintStatus | EnumComplaintStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintStatusFilter<$PrismaModel> | $Enums.ComplaintStatus
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type ComplaintCountOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    classroomNumber?: SortOrder
    block?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    raisedById?: SortOrder
    assignedToId?: SortOrder
    resolutionNote?: SortOrder
    feedbackRating?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComplaintAvgOrderByAggregateInput = {
    priority?: SortOrder
    feedbackRating?: SortOrder
  }

  export type ComplaintMaxOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    classroomNumber?: SortOrder
    block?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    raisedById?: SortOrder
    assignedToId?: SortOrder
    resolutionNote?: SortOrder
    feedbackRating?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComplaintMinOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    classroomNumber?: SortOrder
    block?: SortOrder
    status?: SortOrder
    priority?: SortOrder
    raisedById?: SortOrder
    assignedToId?: SortOrder
    resolutionNote?: SortOrder
    feedbackRating?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComplaintSumOrderByAggregateInput = {
    priority?: SortOrder
    feedbackRating?: SortOrder
  }

  export type EnumComplaintCategoryWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintCategory | EnumComplaintCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintCategoryWithAggregatesFilter<$PrismaModel> | $Enums.ComplaintCategory
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumComplaintCategoryFilter<$PrismaModel>
    _max?: NestedEnumComplaintCategoryFilter<$PrismaModel>
  }

  export type EnumComplaintStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintStatus | EnumComplaintStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintStatusWithAggregatesFilter<$PrismaModel> | $Enums.ComplaintStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumComplaintStatusFilter<$PrismaModel>
    _max?: NestedEnumComplaintStatusFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type StudentProfileCreateNestedOneWithoutUserInput = {
    create?: XOR<StudentProfileCreateWithoutUserInput, StudentProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: StudentProfileCreateOrConnectWithoutUserInput
    connect?: StudentProfileWhereUniqueInput
  }

  export type FacultyProfileCreateNestedOneWithoutUserInput = {
    create?: XOR<FacultyProfileCreateWithoutUserInput, FacultyProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: FacultyProfileCreateOrConnectWithoutUserInput
    connect?: FacultyProfileWhereUniqueInput
  }

  export type AdminProfileCreateNestedOneWithoutUserInput = {
    create?: XOR<AdminProfileCreateWithoutUserInput, AdminProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: AdminProfileCreateOrConnectWithoutUserInput
    connect?: AdminProfileWhereUniqueInput
  }

  export type DoubtCreateNestedManyWithoutPostedByInput = {
    create?: XOR<DoubtCreateWithoutPostedByInput, DoubtUncheckedCreateWithoutPostedByInput> | DoubtCreateWithoutPostedByInput[] | DoubtUncheckedCreateWithoutPostedByInput[]
    connectOrCreate?: DoubtCreateOrConnectWithoutPostedByInput | DoubtCreateOrConnectWithoutPostedByInput[]
    createMany?: DoubtCreateManyPostedByInputEnvelope
    connect?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
  }

  export type AnswerCreateNestedManyWithoutAnsweredByInput = {
    create?: XOR<AnswerCreateWithoutAnsweredByInput, AnswerUncheckedCreateWithoutAnsweredByInput> | AnswerCreateWithoutAnsweredByInput[] | AnswerUncheckedCreateWithoutAnsweredByInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutAnsweredByInput | AnswerCreateOrConnectWithoutAnsweredByInput[]
    createMany?: AnswerCreateManyAnsweredByInputEnvelope
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
  }

  export type ComplaintCreateNestedManyWithoutRaisedByInput = {
    create?: XOR<ComplaintCreateWithoutRaisedByInput, ComplaintUncheckedCreateWithoutRaisedByInput> | ComplaintCreateWithoutRaisedByInput[] | ComplaintUncheckedCreateWithoutRaisedByInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutRaisedByInput | ComplaintCreateOrConnectWithoutRaisedByInput[]
    createMany?: ComplaintCreateManyRaisedByInputEnvelope
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
  }

  export type ComplaintCreateNestedManyWithoutAssignedToInput = {
    create?: XOR<ComplaintCreateWithoutAssignedToInput, ComplaintUncheckedCreateWithoutAssignedToInput> | ComplaintCreateWithoutAssignedToInput[] | ComplaintUncheckedCreateWithoutAssignedToInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutAssignedToInput | ComplaintCreateOrConnectWithoutAssignedToInput[]
    createMany?: ComplaintCreateManyAssignedToInputEnvelope
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
  }

  export type StudentProfileUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<StudentProfileCreateWithoutUserInput, StudentProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: StudentProfileCreateOrConnectWithoutUserInput
    connect?: StudentProfileWhereUniqueInput
  }

  export type FacultyProfileUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<FacultyProfileCreateWithoutUserInput, FacultyProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: FacultyProfileCreateOrConnectWithoutUserInput
    connect?: FacultyProfileWhereUniqueInput
  }

  export type AdminProfileUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<AdminProfileCreateWithoutUserInput, AdminProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: AdminProfileCreateOrConnectWithoutUserInput
    connect?: AdminProfileWhereUniqueInput
  }

  export type DoubtUncheckedCreateNestedManyWithoutPostedByInput = {
    create?: XOR<DoubtCreateWithoutPostedByInput, DoubtUncheckedCreateWithoutPostedByInput> | DoubtCreateWithoutPostedByInput[] | DoubtUncheckedCreateWithoutPostedByInput[]
    connectOrCreate?: DoubtCreateOrConnectWithoutPostedByInput | DoubtCreateOrConnectWithoutPostedByInput[]
    createMany?: DoubtCreateManyPostedByInputEnvelope
    connect?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
  }

  export type AnswerUncheckedCreateNestedManyWithoutAnsweredByInput = {
    create?: XOR<AnswerCreateWithoutAnsweredByInput, AnswerUncheckedCreateWithoutAnsweredByInput> | AnswerCreateWithoutAnsweredByInput[] | AnswerUncheckedCreateWithoutAnsweredByInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutAnsweredByInput | AnswerCreateOrConnectWithoutAnsweredByInput[]
    createMany?: AnswerCreateManyAnsweredByInputEnvelope
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
  }

  export type ComplaintUncheckedCreateNestedManyWithoutRaisedByInput = {
    create?: XOR<ComplaintCreateWithoutRaisedByInput, ComplaintUncheckedCreateWithoutRaisedByInput> | ComplaintCreateWithoutRaisedByInput[] | ComplaintUncheckedCreateWithoutRaisedByInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutRaisedByInput | ComplaintCreateOrConnectWithoutRaisedByInput[]
    createMany?: ComplaintCreateManyRaisedByInputEnvelope
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
  }

  export type ComplaintUncheckedCreateNestedManyWithoutAssignedToInput = {
    create?: XOR<ComplaintCreateWithoutAssignedToInput, ComplaintUncheckedCreateWithoutAssignedToInput> | ComplaintCreateWithoutAssignedToInput[] | ComplaintUncheckedCreateWithoutAssignedToInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutAssignedToInput | ComplaintCreateOrConnectWithoutAssignedToInput[]
    createMany?: ComplaintCreateManyAssignedToInputEnvelope
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type EnumRoleFieldUpdateOperationsInput = {
    set?: $Enums.Role
  }

  export type EnumApprovalStatusFieldUpdateOperationsInput = {
    set?: $Enums.ApprovalStatus
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type StudentProfileUpdateOneWithoutUserNestedInput = {
    create?: XOR<StudentProfileCreateWithoutUserInput, StudentProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: StudentProfileCreateOrConnectWithoutUserInput
    upsert?: StudentProfileUpsertWithoutUserInput
    disconnect?: StudentProfileWhereInput | boolean
    delete?: StudentProfileWhereInput | boolean
    connect?: StudentProfileWhereUniqueInput
    update?: XOR<XOR<StudentProfileUpdateToOneWithWhereWithoutUserInput, StudentProfileUpdateWithoutUserInput>, StudentProfileUncheckedUpdateWithoutUserInput>
  }

  export type FacultyProfileUpdateOneWithoutUserNestedInput = {
    create?: XOR<FacultyProfileCreateWithoutUserInput, FacultyProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: FacultyProfileCreateOrConnectWithoutUserInput
    upsert?: FacultyProfileUpsertWithoutUserInput
    disconnect?: FacultyProfileWhereInput | boolean
    delete?: FacultyProfileWhereInput | boolean
    connect?: FacultyProfileWhereUniqueInput
    update?: XOR<XOR<FacultyProfileUpdateToOneWithWhereWithoutUserInput, FacultyProfileUpdateWithoutUserInput>, FacultyProfileUncheckedUpdateWithoutUserInput>
  }

  export type AdminProfileUpdateOneWithoutUserNestedInput = {
    create?: XOR<AdminProfileCreateWithoutUserInput, AdminProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: AdminProfileCreateOrConnectWithoutUserInput
    upsert?: AdminProfileUpsertWithoutUserInput
    disconnect?: AdminProfileWhereInput | boolean
    delete?: AdminProfileWhereInput | boolean
    connect?: AdminProfileWhereUniqueInput
    update?: XOR<XOR<AdminProfileUpdateToOneWithWhereWithoutUserInput, AdminProfileUpdateWithoutUserInput>, AdminProfileUncheckedUpdateWithoutUserInput>
  }

  export type DoubtUpdateManyWithoutPostedByNestedInput = {
    create?: XOR<DoubtCreateWithoutPostedByInput, DoubtUncheckedCreateWithoutPostedByInput> | DoubtCreateWithoutPostedByInput[] | DoubtUncheckedCreateWithoutPostedByInput[]
    connectOrCreate?: DoubtCreateOrConnectWithoutPostedByInput | DoubtCreateOrConnectWithoutPostedByInput[]
    upsert?: DoubtUpsertWithWhereUniqueWithoutPostedByInput | DoubtUpsertWithWhereUniqueWithoutPostedByInput[]
    createMany?: DoubtCreateManyPostedByInputEnvelope
    set?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    disconnect?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    delete?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    connect?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    update?: DoubtUpdateWithWhereUniqueWithoutPostedByInput | DoubtUpdateWithWhereUniqueWithoutPostedByInput[]
    updateMany?: DoubtUpdateManyWithWhereWithoutPostedByInput | DoubtUpdateManyWithWhereWithoutPostedByInput[]
    deleteMany?: DoubtScalarWhereInput | DoubtScalarWhereInput[]
  }

  export type AnswerUpdateManyWithoutAnsweredByNestedInput = {
    create?: XOR<AnswerCreateWithoutAnsweredByInput, AnswerUncheckedCreateWithoutAnsweredByInput> | AnswerCreateWithoutAnsweredByInput[] | AnswerUncheckedCreateWithoutAnsweredByInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutAnsweredByInput | AnswerCreateOrConnectWithoutAnsweredByInput[]
    upsert?: AnswerUpsertWithWhereUniqueWithoutAnsweredByInput | AnswerUpsertWithWhereUniqueWithoutAnsweredByInput[]
    createMany?: AnswerCreateManyAnsweredByInputEnvelope
    set?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    disconnect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    delete?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    update?: AnswerUpdateWithWhereUniqueWithoutAnsweredByInput | AnswerUpdateWithWhereUniqueWithoutAnsweredByInput[]
    updateMany?: AnswerUpdateManyWithWhereWithoutAnsweredByInput | AnswerUpdateManyWithWhereWithoutAnsweredByInput[]
    deleteMany?: AnswerScalarWhereInput | AnswerScalarWhereInput[]
  }

  export type ComplaintUpdateManyWithoutRaisedByNestedInput = {
    create?: XOR<ComplaintCreateWithoutRaisedByInput, ComplaintUncheckedCreateWithoutRaisedByInput> | ComplaintCreateWithoutRaisedByInput[] | ComplaintUncheckedCreateWithoutRaisedByInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutRaisedByInput | ComplaintCreateOrConnectWithoutRaisedByInput[]
    upsert?: ComplaintUpsertWithWhereUniqueWithoutRaisedByInput | ComplaintUpsertWithWhereUniqueWithoutRaisedByInput[]
    createMany?: ComplaintCreateManyRaisedByInputEnvelope
    set?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    disconnect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    delete?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    update?: ComplaintUpdateWithWhereUniqueWithoutRaisedByInput | ComplaintUpdateWithWhereUniqueWithoutRaisedByInput[]
    updateMany?: ComplaintUpdateManyWithWhereWithoutRaisedByInput | ComplaintUpdateManyWithWhereWithoutRaisedByInput[]
    deleteMany?: ComplaintScalarWhereInput | ComplaintScalarWhereInput[]
  }

  export type ComplaintUpdateManyWithoutAssignedToNestedInput = {
    create?: XOR<ComplaintCreateWithoutAssignedToInput, ComplaintUncheckedCreateWithoutAssignedToInput> | ComplaintCreateWithoutAssignedToInput[] | ComplaintUncheckedCreateWithoutAssignedToInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutAssignedToInput | ComplaintCreateOrConnectWithoutAssignedToInput[]
    upsert?: ComplaintUpsertWithWhereUniqueWithoutAssignedToInput | ComplaintUpsertWithWhereUniqueWithoutAssignedToInput[]
    createMany?: ComplaintCreateManyAssignedToInputEnvelope
    set?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    disconnect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    delete?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    update?: ComplaintUpdateWithWhereUniqueWithoutAssignedToInput | ComplaintUpdateWithWhereUniqueWithoutAssignedToInput[]
    updateMany?: ComplaintUpdateManyWithWhereWithoutAssignedToInput | ComplaintUpdateManyWithWhereWithoutAssignedToInput[]
    deleteMany?: ComplaintScalarWhereInput | ComplaintScalarWhereInput[]
  }

  export type StudentProfileUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<StudentProfileCreateWithoutUserInput, StudentProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: StudentProfileCreateOrConnectWithoutUserInput
    upsert?: StudentProfileUpsertWithoutUserInput
    disconnect?: StudentProfileWhereInput | boolean
    delete?: StudentProfileWhereInput | boolean
    connect?: StudentProfileWhereUniqueInput
    update?: XOR<XOR<StudentProfileUpdateToOneWithWhereWithoutUserInput, StudentProfileUpdateWithoutUserInput>, StudentProfileUncheckedUpdateWithoutUserInput>
  }

  export type FacultyProfileUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<FacultyProfileCreateWithoutUserInput, FacultyProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: FacultyProfileCreateOrConnectWithoutUserInput
    upsert?: FacultyProfileUpsertWithoutUserInput
    disconnect?: FacultyProfileWhereInput | boolean
    delete?: FacultyProfileWhereInput | boolean
    connect?: FacultyProfileWhereUniqueInput
    update?: XOR<XOR<FacultyProfileUpdateToOneWithWhereWithoutUserInput, FacultyProfileUpdateWithoutUserInput>, FacultyProfileUncheckedUpdateWithoutUserInput>
  }

  export type AdminProfileUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<AdminProfileCreateWithoutUserInput, AdminProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: AdminProfileCreateOrConnectWithoutUserInput
    upsert?: AdminProfileUpsertWithoutUserInput
    disconnect?: AdminProfileWhereInput | boolean
    delete?: AdminProfileWhereInput | boolean
    connect?: AdminProfileWhereUniqueInput
    update?: XOR<XOR<AdminProfileUpdateToOneWithWhereWithoutUserInput, AdminProfileUpdateWithoutUserInput>, AdminProfileUncheckedUpdateWithoutUserInput>
  }

  export type DoubtUncheckedUpdateManyWithoutPostedByNestedInput = {
    create?: XOR<DoubtCreateWithoutPostedByInput, DoubtUncheckedCreateWithoutPostedByInput> | DoubtCreateWithoutPostedByInput[] | DoubtUncheckedCreateWithoutPostedByInput[]
    connectOrCreate?: DoubtCreateOrConnectWithoutPostedByInput | DoubtCreateOrConnectWithoutPostedByInput[]
    upsert?: DoubtUpsertWithWhereUniqueWithoutPostedByInput | DoubtUpsertWithWhereUniqueWithoutPostedByInput[]
    createMany?: DoubtCreateManyPostedByInputEnvelope
    set?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    disconnect?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    delete?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    connect?: DoubtWhereUniqueInput | DoubtWhereUniqueInput[]
    update?: DoubtUpdateWithWhereUniqueWithoutPostedByInput | DoubtUpdateWithWhereUniqueWithoutPostedByInput[]
    updateMany?: DoubtUpdateManyWithWhereWithoutPostedByInput | DoubtUpdateManyWithWhereWithoutPostedByInput[]
    deleteMany?: DoubtScalarWhereInput | DoubtScalarWhereInput[]
  }

  export type AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput = {
    create?: XOR<AnswerCreateWithoutAnsweredByInput, AnswerUncheckedCreateWithoutAnsweredByInput> | AnswerCreateWithoutAnsweredByInput[] | AnswerUncheckedCreateWithoutAnsweredByInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutAnsweredByInput | AnswerCreateOrConnectWithoutAnsweredByInput[]
    upsert?: AnswerUpsertWithWhereUniqueWithoutAnsweredByInput | AnswerUpsertWithWhereUniqueWithoutAnsweredByInput[]
    createMany?: AnswerCreateManyAnsweredByInputEnvelope
    set?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    disconnect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    delete?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    update?: AnswerUpdateWithWhereUniqueWithoutAnsweredByInput | AnswerUpdateWithWhereUniqueWithoutAnsweredByInput[]
    updateMany?: AnswerUpdateManyWithWhereWithoutAnsweredByInput | AnswerUpdateManyWithWhereWithoutAnsweredByInput[]
    deleteMany?: AnswerScalarWhereInput | AnswerScalarWhereInput[]
  }

  export type ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput = {
    create?: XOR<ComplaintCreateWithoutRaisedByInput, ComplaintUncheckedCreateWithoutRaisedByInput> | ComplaintCreateWithoutRaisedByInput[] | ComplaintUncheckedCreateWithoutRaisedByInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutRaisedByInput | ComplaintCreateOrConnectWithoutRaisedByInput[]
    upsert?: ComplaintUpsertWithWhereUniqueWithoutRaisedByInput | ComplaintUpsertWithWhereUniqueWithoutRaisedByInput[]
    createMany?: ComplaintCreateManyRaisedByInputEnvelope
    set?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    disconnect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    delete?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    update?: ComplaintUpdateWithWhereUniqueWithoutRaisedByInput | ComplaintUpdateWithWhereUniqueWithoutRaisedByInput[]
    updateMany?: ComplaintUpdateManyWithWhereWithoutRaisedByInput | ComplaintUpdateManyWithWhereWithoutRaisedByInput[]
    deleteMany?: ComplaintScalarWhereInput | ComplaintScalarWhereInput[]
  }

  export type ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput = {
    create?: XOR<ComplaintCreateWithoutAssignedToInput, ComplaintUncheckedCreateWithoutAssignedToInput> | ComplaintCreateWithoutAssignedToInput[] | ComplaintUncheckedCreateWithoutAssignedToInput[]
    connectOrCreate?: ComplaintCreateOrConnectWithoutAssignedToInput | ComplaintCreateOrConnectWithoutAssignedToInput[]
    upsert?: ComplaintUpsertWithWhereUniqueWithoutAssignedToInput | ComplaintUpsertWithWhereUniqueWithoutAssignedToInput[]
    createMany?: ComplaintCreateManyAssignedToInputEnvelope
    set?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    disconnect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    delete?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    connect?: ComplaintWhereUniqueInput | ComplaintWhereUniqueInput[]
    update?: ComplaintUpdateWithWhereUniqueWithoutAssignedToInput | ComplaintUpdateWithWhereUniqueWithoutAssignedToInput[]
    updateMany?: ComplaintUpdateManyWithWhereWithoutAssignedToInput | ComplaintUpdateManyWithWhereWithoutAssignedToInput[]
    deleteMany?: ComplaintScalarWhereInput | ComplaintScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutStudentProfileInput = {
    create?: XOR<UserCreateWithoutStudentProfileInput, UserUncheckedCreateWithoutStudentProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutStudentProfileInput
    connect?: UserWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutStudentProfileNestedInput = {
    create?: XOR<UserCreateWithoutStudentProfileInput, UserUncheckedCreateWithoutStudentProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutStudentProfileInput
    upsert?: UserUpsertWithoutStudentProfileInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutStudentProfileInput, UserUpdateWithoutStudentProfileInput>, UserUncheckedUpdateWithoutStudentProfileInput>
  }

  export type FacultyProfileCreatesubjectsInput = {
    set: string[]
  }

  export type UserCreateNestedOneWithoutFacultyProfileInput = {
    create?: XOR<UserCreateWithoutFacultyProfileInput, UserUncheckedCreateWithoutFacultyProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutFacultyProfileInput
    connect?: UserWhereUniqueInput
  }

  export type FacultyProfileUpdatesubjectsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type UserUpdateOneRequiredWithoutFacultyProfileNestedInput = {
    create?: XOR<UserCreateWithoutFacultyProfileInput, UserUncheckedCreateWithoutFacultyProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutFacultyProfileInput
    upsert?: UserUpsertWithoutFacultyProfileInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutFacultyProfileInput, UserUpdateWithoutFacultyProfileInput>, UserUncheckedUpdateWithoutFacultyProfileInput>
  }

  export type AdminProfileCreateassignedDepartmentsInput = {
    set: string[]
  }

  export type AdminProfileCreateallowedCategoriesInput = {
    set: string[]
  }

  export type UserCreateNestedOneWithoutAdminProfileInput = {
    create?: XOR<UserCreateWithoutAdminProfileInput, UserUncheckedCreateWithoutAdminProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutAdminProfileInput
    connect?: UserWhereUniqueInput
  }

  export type EnumAdminLevelFieldUpdateOperationsInput = {
    set?: $Enums.AdminLevel
  }

  export type AdminProfileUpdateassignedDepartmentsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type AdminProfileUpdateallowedCategoriesInput = {
    set?: string[]
    push?: string | string[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type UserUpdateOneRequiredWithoutAdminProfileNestedInput = {
    create?: XOR<UserCreateWithoutAdminProfileInput, UserUncheckedCreateWithoutAdminProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutAdminProfileInput
    upsert?: UserUpsertWithoutAdminProfileInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAdminProfileInput, UserUpdateWithoutAdminProfileInput>, UserUncheckedUpdateWithoutAdminProfileInput>
  }

  export type DoubtCreatelabelsInput = {
    set: string[]
  }

  export type UserCreateNestedOneWithoutDoubtsInput = {
    create?: XOR<UserCreateWithoutDoubtsInput, UserUncheckedCreateWithoutDoubtsInput>
    connectOrCreate?: UserCreateOrConnectWithoutDoubtsInput
    connect?: UserWhereUniqueInput
  }

  export type AnswerCreateNestedManyWithoutDoubtInput = {
    create?: XOR<AnswerCreateWithoutDoubtInput, AnswerUncheckedCreateWithoutDoubtInput> | AnswerCreateWithoutDoubtInput[] | AnswerUncheckedCreateWithoutDoubtInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutDoubtInput | AnswerCreateOrConnectWithoutDoubtInput[]
    createMany?: AnswerCreateManyDoubtInputEnvelope
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
  }

  export type AnswerUncheckedCreateNestedManyWithoutDoubtInput = {
    create?: XOR<AnswerCreateWithoutDoubtInput, AnswerUncheckedCreateWithoutDoubtInput> | AnswerCreateWithoutDoubtInput[] | AnswerUncheckedCreateWithoutDoubtInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutDoubtInput | AnswerCreateOrConnectWithoutDoubtInput[]
    createMany?: AnswerCreateManyDoubtInputEnvelope
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
  }

  export type EnumSubjectFieldUpdateOperationsInput = {
    set?: $Enums.Subject
  }

  export type DoubtUpdatelabelsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type EnumDoubtStatusFieldUpdateOperationsInput = {
    set?: $Enums.DoubtStatus
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type UserUpdateOneRequiredWithoutDoubtsNestedInput = {
    create?: XOR<UserCreateWithoutDoubtsInput, UserUncheckedCreateWithoutDoubtsInput>
    connectOrCreate?: UserCreateOrConnectWithoutDoubtsInput
    upsert?: UserUpsertWithoutDoubtsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutDoubtsInput, UserUpdateWithoutDoubtsInput>, UserUncheckedUpdateWithoutDoubtsInput>
  }

  export type AnswerUpdateManyWithoutDoubtNestedInput = {
    create?: XOR<AnswerCreateWithoutDoubtInput, AnswerUncheckedCreateWithoutDoubtInput> | AnswerCreateWithoutDoubtInput[] | AnswerUncheckedCreateWithoutDoubtInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutDoubtInput | AnswerCreateOrConnectWithoutDoubtInput[]
    upsert?: AnswerUpsertWithWhereUniqueWithoutDoubtInput | AnswerUpsertWithWhereUniqueWithoutDoubtInput[]
    createMany?: AnswerCreateManyDoubtInputEnvelope
    set?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    disconnect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    delete?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    update?: AnswerUpdateWithWhereUniqueWithoutDoubtInput | AnswerUpdateWithWhereUniqueWithoutDoubtInput[]
    updateMany?: AnswerUpdateManyWithWhereWithoutDoubtInput | AnswerUpdateManyWithWhereWithoutDoubtInput[]
    deleteMany?: AnswerScalarWhereInput | AnswerScalarWhereInput[]
  }

  export type AnswerUncheckedUpdateManyWithoutDoubtNestedInput = {
    create?: XOR<AnswerCreateWithoutDoubtInput, AnswerUncheckedCreateWithoutDoubtInput> | AnswerCreateWithoutDoubtInput[] | AnswerUncheckedCreateWithoutDoubtInput[]
    connectOrCreate?: AnswerCreateOrConnectWithoutDoubtInput | AnswerCreateOrConnectWithoutDoubtInput[]
    upsert?: AnswerUpsertWithWhereUniqueWithoutDoubtInput | AnswerUpsertWithWhereUniqueWithoutDoubtInput[]
    createMany?: AnswerCreateManyDoubtInputEnvelope
    set?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    disconnect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    delete?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    connect?: AnswerWhereUniqueInput | AnswerWhereUniqueInput[]
    update?: AnswerUpdateWithWhereUniqueWithoutDoubtInput | AnswerUpdateWithWhereUniqueWithoutDoubtInput[]
    updateMany?: AnswerUpdateManyWithWhereWithoutDoubtInput | AnswerUpdateManyWithWhereWithoutDoubtInput[]
    deleteMany?: AnswerScalarWhereInput | AnswerScalarWhereInput[]
  }

  export type DoubtCreateNestedOneWithoutAnswersInput = {
    create?: XOR<DoubtCreateWithoutAnswersInput, DoubtUncheckedCreateWithoutAnswersInput>
    connectOrCreate?: DoubtCreateOrConnectWithoutAnswersInput
    connect?: DoubtWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutAnswersInput = {
    create?: XOR<UserCreateWithoutAnswersInput, UserUncheckedCreateWithoutAnswersInput>
    connectOrCreate?: UserCreateOrConnectWithoutAnswersInput
    connect?: UserWhereUniqueInput
  }

  export type DoubtUpdateOneRequiredWithoutAnswersNestedInput = {
    create?: XOR<DoubtCreateWithoutAnswersInput, DoubtUncheckedCreateWithoutAnswersInput>
    connectOrCreate?: DoubtCreateOrConnectWithoutAnswersInput
    upsert?: DoubtUpsertWithoutAnswersInput
    connect?: DoubtWhereUniqueInput
    update?: XOR<XOR<DoubtUpdateToOneWithWhereWithoutAnswersInput, DoubtUpdateWithoutAnswersInput>, DoubtUncheckedUpdateWithoutAnswersInput>
  }

  export type UserUpdateOneRequiredWithoutAnswersNestedInput = {
    create?: XOR<UserCreateWithoutAnswersInput, UserUncheckedCreateWithoutAnswersInput>
    connectOrCreate?: UserCreateOrConnectWithoutAnswersInput
    upsert?: UserUpsertWithoutAnswersInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAnswersInput, UserUpdateWithoutAnswersInput>, UserUncheckedUpdateWithoutAnswersInput>
  }

  export type UserCreateNestedOneWithoutRaisedComplaintsInput = {
    create?: XOR<UserCreateWithoutRaisedComplaintsInput, UserUncheckedCreateWithoutRaisedComplaintsInput>
    connectOrCreate?: UserCreateOrConnectWithoutRaisedComplaintsInput
    connect?: UserWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutAssignedComplaintsInput = {
    create?: XOR<UserCreateWithoutAssignedComplaintsInput, UserUncheckedCreateWithoutAssignedComplaintsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAssignedComplaintsInput
    connect?: UserWhereUniqueInput
  }

  export type EnumComplaintCategoryFieldUpdateOperationsInput = {
    set?: $Enums.ComplaintCategory
  }

  export type EnumComplaintStatusFieldUpdateOperationsInput = {
    set?: $Enums.ComplaintStatus
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutRaisedComplaintsNestedInput = {
    create?: XOR<UserCreateWithoutRaisedComplaintsInput, UserUncheckedCreateWithoutRaisedComplaintsInput>
    connectOrCreate?: UserCreateOrConnectWithoutRaisedComplaintsInput
    upsert?: UserUpsertWithoutRaisedComplaintsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutRaisedComplaintsInput, UserUpdateWithoutRaisedComplaintsInput>, UserUncheckedUpdateWithoutRaisedComplaintsInput>
  }

  export type UserUpdateOneWithoutAssignedComplaintsNestedInput = {
    create?: XOR<UserCreateWithoutAssignedComplaintsInput, UserUncheckedCreateWithoutAssignedComplaintsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAssignedComplaintsInput
    upsert?: UserUpsertWithoutAssignedComplaintsInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAssignedComplaintsInput, UserUpdateWithoutAssignedComplaintsInput>, UserUncheckedUpdateWithoutAssignedComplaintsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedEnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role
  }

  export type NestedEnumApprovalStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.ApprovalStatus | EnumApprovalStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumApprovalStatusFilter<$PrismaModel> | $Enums.ApprovalStatus
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedEnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type NestedEnumApprovalStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ApprovalStatus | EnumApprovalStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ApprovalStatus[] | ListEnumApprovalStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumApprovalStatusWithAggregatesFilter<$PrismaModel> | $Enums.ApprovalStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumApprovalStatusFilter<$PrismaModel>
    _max?: NestedEnumApprovalStatusFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedEnumAdminLevelFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminLevel | EnumAdminLevelFieldRefInput<$PrismaModel>
    in?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminLevelFilter<$PrismaModel> | $Enums.AdminLevel
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedEnumAdminLevelWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AdminLevel | EnumAdminLevelFieldRefInput<$PrismaModel>
    in?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    notIn?: $Enums.AdminLevel[] | ListEnumAdminLevelFieldRefInput<$PrismaModel>
    not?: NestedEnumAdminLevelWithAggregatesFilter<$PrismaModel> | $Enums.AdminLevel
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAdminLevelFilter<$PrismaModel>
    _max?: NestedEnumAdminLevelFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumSubjectFilter<$PrismaModel = never> = {
    equals?: $Enums.Subject | EnumSubjectFieldRefInput<$PrismaModel>
    in?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    notIn?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    not?: NestedEnumSubjectFilter<$PrismaModel> | $Enums.Subject
  }

  export type NestedEnumDoubtStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.DoubtStatus | EnumDoubtStatusFieldRefInput<$PrismaModel>
    in?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumDoubtStatusFilter<$PrismaModel> | $Enums.DoubtStatus
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumSubjectWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Subject | EnumSubjectFieldRefInput<$PrismaModel>
    in?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    notIn?: $Enums.Subject[] | ListEnumSubjectFieldRefInput<$PrismaModel>
    not?: NestedEnumSubjectWithAggregatesFilter<$PrismaModel> | $Enums.Subject
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubjectFilter<$PrismaModel>
    _max?: NestedEnumSubjectFilter<$PrismaModel>
  }

  export type NestedEnumDoubtStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.DoubtStatus | EnumDoubtStatusFieldRefInput<$PrismaModel>
    in?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.DoubtStatus[] | ListEnumDoubtStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumDoubtStatusWithAggregatesFilter<$PrismaModel> | $Enums.DoubtStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumDoubtStatusFilter<$PrismaModel>
    _max?: NestedEnumDoubtStatusFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedEnumComplaintCategoryFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintCategory | EnumComplaintCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintCategoryFilter<$PrismaModel> | $Enums.ComplaintCategory
  }

  export type NestedEnumComplaintStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintStatus | EnumComplaintStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintStatusFilter<$PrismaModel> | $Enums.ComplaintStatus
  }

  export type NestedEnumComplaintCategoryWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintCategory | EnumComplaintCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintCategory[] | ListEnumComplaintCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintCategoryWithAggregatesFilter<$PrismaModel> | $Enums.ComplaintCategory
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumComplaintCategoryFilter<$PrismaModel>
    _max?: NestedEnumComplaintCategoryFilter<$PrismaModel>
  }

  export type NestedEnumComplaintStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ComplaintStatus | EnumComplaintStatusFieldRefInput<$PrismaModel>
    in?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.ComplaintStatus[] | ListEnumComplaintStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumComplaintStatusWithAggregatesFilter<$PrismaModel> | $Enums.ComplaintStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumComplaintStatusFilter<$PrismaModel>
    _max?: NestedEnumComplaintStatusFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type StudentProfileCreateWithoutUserInput = {
    id?: string
    enrollmentNumber: string
    department: string
    branch: string
    semester: number
    phoneNumber: number
    address: string
    isStudying?: boolean
    guardianName: string
    guardianPhone: string
    doubtsAsked?: number
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StudentProfileUncheckedCreateWithoutUserInput = {
    id?: string
    enrollmentNumber: string
    department: string
    branch: string
    semester: number
    phoneNumber: number
    address: string
    isStudying?: boolean
    guardianName: string
    guardianPhone: string
    doubtsAsked?: number
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StudentProfileCreateOrConnectWithoutUserInput = {
    where: StudentProfileWhereUniqueInput
    create: XOR<StudentProfileCreateWithoutUserInput, StudentProfileUncheckedCreateWithoutUserInput>
  }

  export type FacultyProfileCreateWithoutUserInput = {
    id?: string
    department: string
    branch: string
    phoneNumber: string
    address: string
    isTeaching?: boolean
    subjects?: FacultyProfileCreatesubjectsInput | string[]
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type FacultyProfileUncheckedCreateWithoutUserInput = {
    id?: string
    department: string
    branch: string
    phoneNumber: string
    address: string
    isTeaching?: boolean
    subjects?: FacultyProfileCreatesubjectsInput | string[]
    doubtsSolved?: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type FacultyProfileCreateOrConnectWithoutUserInput = {
    where: FacultyProfileWhereUniqueInput
    create: XOR<FacultyProfileCreateWithoutUserInput, FacultyProfileUncheckedCreateWithoutUserInput>
  }

  export type AdminProfileCreateWithoutUserInput = {
    id?: string
    adminLevel: $Enums.AdminLevel
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: AdminProfileCreateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileCreateallowedCategoriesInput | string[]
    complaintsAssigned?: number
    complaintsClosed?: number
    usersManaged?: number
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AdminProfileUncheckedCreateWithoutUserInput = {
    id?: string
    adminLevel: $Enums.AdminLevel
    manageUsers?: boolean
    manageComplaints?: boolean
    manageDoubts?: boolean
    viewAnalytics?: boolean
    assignedDepartments?: AdminProfileCreateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileCreateallowedCategoriesInput | string[]
    complaintsAssigned?: number
    complaintsClosed?: number
    usersManaged?: number
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AdminProfileCreateOrConnectWithoutUserInput = {
    where: AdminProfileWhereUniqueInput
    create: XOR<AdminProfileCreateWithoutUserInput, AdminProfileUncheckedCreateWithoutUserInput>
  }

  export type DoubtCreateWithoutPostedByInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    answers?: AnswerCreateNestedManyWithoutDoubtInput
  }

  export type DoubtUncheckedCreateWithoutPostedByInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    answers?: AnswerUncheckedCreateNestedManyWithoutDoubtInput
  }

  export type DoubtCreateOrConnectWithoutPostedByInput = {
    where: DoubtWhereUniqueInput
    create: XOR<DoubtCreateWithoutPostedByInput, DoubtUncheckedCreateWithoutPostedByInput>
  }

  export type DoubtCreateManyPostedByInputEnvelope = {
    data: DoubtCreateManyPostedByInput | DoubtCreateManyPostedByInput[]
    skipDuplicates?: boolean
  }

  export type AnswerCreateWithoutAnsweredByInput = {
    id?: string
    content: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    doubt: DoubtCreateNestedOneWithoutAnswersInput
  }

  export type AnswerUncheckedCreateWithoutAnsweredByInput = {
    id?: string
    doubtId: string
    content: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnswerCreateOrConnectWithoutAnsweredByInput = {
    where: AnswerWhereUniqueInput
    create: XOR<AnswerCreateWithoutAnsweredByInput, AnswerUncheckedCreateWithoutAnsweredByInput>
  }

  export type AnswerCreateManyAnsweredByInputEnvelope = {
    data: AnswerCreateManyAnsweredByInput | AnswerCreateManyAnsweredByInput[]
    skipDuplicates?: boolean
  }

  export type ComplaintCreateWithoutRaisedByInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    assignedTo?: UserCreateNestedOneWithoutAssignedComplaintsInput
  }

  export type ComplaintUncheckedCreateWithoutRaisedByInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    assignedToId?: string | null
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComplaintCreateOrConnectWithoutRaisedByInput = {
    where: ComplaintWhereUniqueInput
    create: XOR<ComplaintCreateWithoutRaisedByInput, ComplaintUncheckedCreateWithoutRaisedByInput>
  }

  export type ComplaintCreateManyRaisedByInputEnvelope = {
    data: ComplaintCreateManyRaisedByInput | ComplaintCreateManyRaisedByInput[]
    skipDuplicates?: boolean
  }

  export type ComplaintCreateWithoutAssignedToInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    raisedBy: UserCreateNestedOneWithoutRaisedComplaintsInput
  }

  export type ComplaintUncheckedCreateWithoutAssignedToInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    raisedById: string
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComplaintCreateOrConnectWithoutAssignedToInput = {
    where: ComplaintWhereUniqueInput
    create: XOR<ComplaintCreateWithoutAssignedToInput, ComplaintUncheckedCreateWithoutAssignedToInput>
  }

  export type ComplaintCreateManyAssignedToInputEnvelope = {
    data: ComplaintCreateManyAssignedToInput | ComplaintCreateManyAssignedToInput[]
    skipDuplicates?: boolean
  }

  export type StudentProfileUpsertWithoutUserInput = {
    update: XOR<StudentProfileUpdateWithoutUserInput, StudentProfileUncheckedUpdateWithoutUserInput>
    create: XOR<StudentProfileCreateWithoutUserInput, StudentProfileUncheckedCreateWithoutUserInput>
    where?: StudentProfileWhereInput
  }

  export type StudentProfileUpdateToOneWithWhereWithoutUserInput = {
    where?: StudentProfileWhereInput
    data: XOR<StudentProfileUpdateWithoutUserInput, StudentProfileUncheckedUpdateWithoutUserInput>
  }

  export type StudentProfileUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    enrollmentNumber?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    phoneNumber?: IntFieldUpdateOperationsInput | number
    address?: StringFieldUpdateOperationsInput | string
    isStudying?: BoolFieldUpdateOperationsInput | boolean
    guardianName?: StringFieldUpdateOperationsInput | string
    guardianPhone?: StringFieldUpdateOperationsInput | string
    doubtsAsked?: IntFieldUpdateOperationsInput | number
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StudentProfileUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    enrollmentNumber?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    phoneNumber?: IntFieldUpdateOperationsInput | number
    address?: StringFieldUpdateOperationsInput | string
    isStudying?: BoolFieldUpdateOperationsInput | boolean
    guardianName?: StringFieldUpdateOperationsInput | string
    guardianPhone?: StringFieldUpdateOperationsInput | string
    doubtsAsked?: IntFieldUpdateOperationsInput | number
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FacultyProfileUpsertWithoutUserInput = {
    update: XOR<FacultyProfileUpdateWithoutUserInput, FacultyProfileUncheckedUpdateWithoutUserInput>
    create: XOR<FacultyProfileCreateWithoutUserInput, FacultyProfileUncheckedCreateWithoutUserInput>
    where?: FacultyProfileWhereInput
  }

  export type FacultyProfileUpdateToOneWithWhereWithoutUserInput = {
    where?: FacultyProfileWhereInput
    data: XOR<FacultyProfileUpdateWithoutUserInput, FacultyProfileUncheckedUpdateWithoutUserInput>
  }

  export type FacultyProfileUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    phoneNumber?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isTeaching?: BoolFieldUpdateOperationsInput | boolean
    subjects?: FacultyProfileUpdatesubjectsInput | string[]
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FacultyProfileUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    department?: StringFieldUpdateOperationsInput | string
    branch?: StringFieldUpdateOperationsInput | string
    phoneNumber?: StringFieldUpdateOperationsInput | string
    address?: StringFieldUpdateOperationsInput | string
    isTeaching?: BoolFieldUpdateOperationsInput | boolean
    subjects?: FacultyProfileUpdatesubjectsInput | string[]
    doubtsSolved?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminProfileUpsertWithoutUserInput = {
    update: XOR<AdminProfileUpdateWithoutUserInput, AdminProfileUncheckedUpdateWithoutUserInput>
    create: XOR<AdminProfileCreateWithoutUserInput, AdminProfileUncheckedCreateWithoutUserInput>
    where?: AdminProfileWhereInput
  }

  export type AdminProfileUpdateToOneWithWhereWithoutUserInput = {
    where?: AdminProfileWhereInput
    data: XOR<AdminProfileUpdateWithoutUserInput, AdminProfileUncheckedUpdateWithoutUserInput>
  }

  export type AdminProfileUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminLevel?: EnumAdminLevelFieldUpdateOperationsInput | $Enums.AdminLevel
    manageUsers?: BoolFieldUpdateOperationsInput | boolean
    manageComplaints?: BoolFieldUpdateOperationsInput | boolean
    manageDoubts?: BoolFieldUpdateOperationsInput | boolean
    viewAnalytics?: BoolFieldUpdateOperationsInput | boolean
    assignedDepartments?: AdminProfileUpdateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileUpdateallowedCategoriesInput | string[]
    complaintsAssigned?: IntFieldUpdateOperationsInput | number
    complaintsClosed?: IntFieldUpdateOperationsInput | number
    usersManaged?: IntFieldUpdateOperationsInput | number
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AdminProfileUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    adminLevel?: EnumAdminLevelFieldUpdateOperationsInput | $Enums.AdminLevel
    manageUsers?: BoolFieldUpdateOperationsInput | boolean
    manageComplaints?: BoolFieldUpdateOperationsInput | boolean
    manageDoubts?: BoolFieldUpdateOperationsInput | boolean
    viewAnalytics?: BoolFieldUpdateOperationsInput | boolean
    assignedDepartments?: AdminProfileUpdateassignedDepartmentsInput | string[]
    allowedCategories?: AdminProfileUpdateallowedCategoriesInput | string[]
    complaintsAssigned?: IntFieldUpdateOperationsInput | number
    complaintsClosed?: IntFieldUpdateOperationsInput | number
    usersManaged?: IntFieldUpdateOperationsInput | number
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DoubtUpsertWithWhereUniqueWithoutPostedByInput = {
    where: DoubtWhereUniqueInput
    update: XOR<DoubtUpdateWithoutPostedByInput, DoubtUncheckedUpdateWithoutPostedByInput>
    create: XOR<DoubtCreateWithoutPostedByInput, DoubtUncheckedCreateWithoutPostedByInput>
  }

  export type DoubtUpdateWithWhereUniqueWithoutPostedByInput = {
    where: DoubtWhereUniqueInput
    data: XOR<DoubtUpdateWithoutPostedByInput, DoubtUncheckedUpdateWithoutPostedByInput>
  }

  export type DoubtUpdateManyWithWhereWithoutPostedByInput = {
    where: DoubtScalarWhereInput
    data: XOR<DoubtUpdateManyMutationInput, DoubtUncheckedUpdateManyWithoutPostedByInput>
  }

  export type DoubtScalarWhereInput = {
    AND?: DoubtScalarWhereInput | DoubtScalarWhereInput[]
    OR?: DoubtScalarWhereInput[]
    NOT?: DoubtScalarWhereInput | DoubtScalarWhereInput[]
    id?: StringFilter<"Doubt"> | string
    title?: StringFilter<"Doubt"> | string
    description?: StringFilter<"Doubt"> | string
    semester?: IntFilter<"Doubt"> | number
    subject?: EnumSubjectFilter<"Doubt"> | $Enums.Subject
    labels?: StringNullableListFilter<"Doubt">
    postedById?: StringFilter<"Doubt"> | string
    status?: EnumDoubtStatusFilter<"Doubt"> | $Enums.DoubtStatus
    views?: IntFilter<"Doubt"> | number
    upVoteCount?: IntFilter<"Doubt"> | number
    answerCount?: IntFilter<"Doubt"> | number
    acceptedAnswerId?: StringNullableFilter<"Doubt"> | string | null
    edited?: BoolFilter<"Doubt"> | boolean
    createdAt?: DateTimeFilter<"Doubt"> | Date | string
    updatedAt?: DateTimeFilter<"Doubt"> | Date | string
  }

  export type AnswerUpsertWithWhereUniqueWithoutAnsweredByInput = {
    where: AnswerWhereUniqueInput
    update: XOR<AnswerUpdateWithoutAnsweredByInput, AnswerUncheckedUpdateWithoutAnsweredByInput>
    create: XOR<AnswerCreateWithoutAnsweredByInput, AnswerUncheckedCreateWithoutAnsweredByInput>
  }

  export type AnswerUpdateWithWhereUniqueWithoutAnsweredByInput = {
    where: AnswerWhereUniqueInput
    data: XOR<AnswerUpdateWithoutAnsweredByInput, AnswerUncheckedUpdateWithoutAnsweredByInput>
  }

  export type AnswerUpdateManyWithWhereWithoutAnsweredByInput = {
    where: AnswerScalarWhereInput
    data: XOR<AnswerUpdateManyMutationInput, AnswerUncheckedUpdateManyWithoutAnsweredByInput>
  }

  export type AnswerScalarWhereInput = {
    AND?: AnswerScalarWhereInput | AnswerScalarWhereInput[]
    OR?: AnswerScalarWhereInput[]
    NOT?: AnswerScalarWhereInput | AnswerScalarWhereInput[]
    id?: StringFilter<"Answer"> | string
    doubtId?: StringFilter<"Answer"> | string
    content?: StringFilter<"Answer"> | string
    answeredById?: StringFilter<"Answer"> | string
    upvotes?: IntFilter<"Answer"> | number
    isVerified?: BoolFilter<"Answer"> | boolean
    isAccepted?: BoolFilter<"Answer"> | boolean
    edited?: BoolFilter<"Answer"> | boolean
    createdAt?: DateTimeFilter<"Answer"> | Date | string
    updatedAt?: DateTimeFilter<"Answer"> | Date | string
  }

  export type ComplaintUpsertWithWhereUniqueWithoutRaisedByInput = {
    where: ComplaintWhereUniqueInput
    update: XOR<ComplaintUpdateWithoutRaisedByInput, ComplaintUncheckedUpdateWithoutRaisedByInput>
    create: XOR<ComplaintCreateWithoutRaisedByInput, ComplaintUncheckedCreateWithoutRaisedByInput>
  }

  export type ComplaintUpdateWithWhereUniqueWithoutRaisedByInput = {
    where: ComplaintWhereUniqueInput
    data: XOR<ComplaintUpdateWithoutRaisedByInput, ComplaintUncheckedUpdateWithoutRaisedByInput>
  }

  export type ComplaintUpdateManyWithWhereWithoutRaisedByInput = {
    where: ComplaintScalarWhereInput
    data: XOR<ComplaintUpdateManyMutationInput, ComplaintUncheckedUpdateManyWithoutRaisedByInput>
  }

  export type ComplaintScalarWhereInput = {
    AND?: ComplaintScalarWhereInput | ComplaintScalarWhereInput[]
    OR?: ComplaintScalarWhereInput[]
    NOT?: ComplaintScalarWhereInput | ComplaintScalarWhereInput[]
    id?: StringFilter<"Complaint"> | string
    title?: StringFilter<"Complaint"> | string
    description?: StringFilter<"Complaint"> | string
    category?: EnumComplaintCategoryFilter<"Complaint"> | $Enums.ComplaintCategory
    classroomNumber?: StringFilter<"Complaint"> | string
    block?: StringFilter<"Complaint"> | string
    status?: EnumComplaintStatusFilter<"Complaint"> | $Enums.ComplaintStatus
    priority?: IntFilter<"Complaint"> | number
    raisedById?: StringFilter<"Complaint"> | string
    assignedToId?: StringNullableFilter<"Complaint"> | string | null
    resolutionNote?: StringNullableFilter<"Complaint"> | string | null
    feedbackRating?: IntNullableFilter<"Complaint"> | number | null
    createdAt?: DateTimeFilter<"Complaint"> | Date | string
    updatedAt?: DateTimeFilter<"Complaint"> | Date | string
  }

  export type ComplaintUpsertWithWhereUniqueWithoutAssignedToInput = {
    where: ComplaintWhereUniqueInput
    update: XOR<ComplaintUpdateWithoutAssignedToInput, ComplaintUncheckedUpdateWithoutAssignedToInput>
    create: XOR<ComplaintCreateWithoutAssignedToInput, ComplaintUncheckedCreateWithoutAssignedToInput>
  }

  export type ComplaintUpdateWithWhereUniqueWithoutAssignedToInput = {
    where: ComplaintWhereUniqueInput
    data: XOR<ComplaintUpdateWithoutAssignedToInput, ComplaintUncheckedUpdateWithoutAssignedToInput>
  }

  export type ComplaintUpdateManyWithWhereWithoutAssignedToInput = {
    where: ComplaintScalarWhereInput
    data: XOR<ComplaintUpdateManyMutationInput, ComplaintUncheckedUpdateManyWithoutAssignedToInput>
  }

  export type UserCreateWithoutStudentProfileInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateWithoutStudentProfileInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserCreateOrConnectWithoutStudentProfileInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutStudentProfileInput, UserUncheckedCreateWithoutStudentProfileInput>
  }

  export type UserUpsertWithoutStudentProfileInput = {
    update: XOR<UserUpdateWithoutStudentProfileInput, UserUncheckedUpdateWithoutStudentProfileInput>
    create: XOR<UserCreateWithoutStudentProfileInput, UserUncheckedCreateWithoutStudentProfileInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutStudentProfileInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutStudentProfileInput, UserUncheckedUpdateWithoutStudentProfileInput>
  }

  export type UserUpdateWithoutStudentProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateWithoutStudentProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type UserCreateWithoutFacultyProfileInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateWithoutFacultyProfileInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserCreateOrConnectWithoutFacultyProfileInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutFacultyProfileInput, UserUncheckedCreateWithoutFacultyProfileInput>
  }

  export type UserUpsertWithoutFacultyProfileInput = {
    update: XOR<UserUpdateWithoutFacultyProfileInput, UserUncheckedUpdateWithoutFacultyProfileInput>
    create: XOR<UserCreateWithoutFacultyProfileInput, UserUncheckedCreateWithoutFacultyProfileInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutFacultyProfileInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutFacultyProfileInput, UserUncheckedUpdateWithoutFacultyProfileInput>
  }

  export type UserUpdateWithoutFacultyProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateWithoutFacultyProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type UserCreateWithoutAdminProfileInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateWithoutAdminProfileInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserCreateOrConnectWithoutAdminProfileInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAdminProfileInput, UserUncheckedCreateWithoutAdminProfileInput>
  }

  export type UserUpsertWithoutAdminProfileInput = {
    update: XOR<UserUpdateWithoutAdminProfileInput, UserUncheckedUpdateWithoutAdminProfileInput>
    create: XOR<UserCreateWithoutAdminProfileInput, UserUncheckedCreateWithoutAdminProfileInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAdminProfileInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAdminProfileInput, UserUncheckedUpdateWithoutAdminProfileInput>
  }

  export type UserUpdateWithoutAdminProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateWithoutAdminProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type UserCreateWithoutDoubtsInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateWithoutDoubtsInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserCreateOrConnectWithoutDoubtsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutDoubtsInput, UserUncheckedCreateWithoutDoubtsInput>
  }

  export type AnswerCreateWithoutDoubtInput = {
    id?: string
    content: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    answeredBy: UserCreateNestedOneWithoutAnswersInput
  }

  export type AnswerUncheckedCreateWithoutDoubtInput = {
    id?: string
    content: string
    answeredById: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnswerCreateOrConnectWithoutDoubtInput = {
    where: AnswerWhereUniqueInput
    create: XOR<AnswerCreateWithoutDoubtInput, AnswerUncheckedCreateWithoutDoubtInput>
  }

  export type AnswerCreateManyDoubtInputEnvelope = {
    data: AnswerCreateManyDoubtInput | AnswerCreateManyDoubtInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutDoubtsInput = {
    update: XOR<UserUpdateWithoutDoubtsInput, UserUncheckedUpdateWithoutDoubtsInput>
    create: XOR<UserCreateWithoutDoubtsInput, UserUncheckedCreateWithoutDoubtsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutDoubtsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutDoubtsInput, UserUncheckedUpdateWithoutDoubtsInput>
  }

  export type UserUpdateWithoutDoubtsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateWithoutDoubtsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type AnswerUpsertWithWhereUniqueWithoutDoubtInput = {
    where: AnswerWhereUniqueInput
    update: XOR<AnswerUpdateWithoutDoubtInput, AnswerUncheckedUpdateWithoutDoubtInput>
    create: XOR<AnswerCreateWithoutDoubtInput, AnswerUncheckedCreateWithoutDoubtInput>
  }

  export type AnswerUpdateWithWhereUniqueWithoutDoubtInput = {
    where: AnswerWhereUniqueInput
    data: XOR<AnswerUpdateWithoutDoubtInput, AnswerUncheckedUpdateWithoutDoubtInput>
  }

  export type AnswerUpdateManyWithWhereWithoutDoubtInput = {
    where: AnswerScalarWhereInput
    data: XOR<AnswerUpdateManyMutationInput, AnswerUncheckedUpdateManyWithoutDoubtInput>
  }

  export type DoubtCreateWithoutAnswersInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    postedBy: UserCreateNestedOneWithoutDoubtsInput
  }

  export type DoubtUncheckedCreateWithoutAnswersInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    postedById: string
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DoubtCreateOrConnectWithoutAnswersInput = {
    where: DoubtWhereUniqueInput
    create: XOR<DoubtCreateWithoutAnswersInput, DoubtUncheckedCreateWithoutAnswersInput>
  }

  export type UserCreateWithoutAnswersInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateWithoutAnswersInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserCreateOrConnectWithoutAnswersInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAnswersInput, UserUncheckedCreateWithoutAnswersInput>
  }

  export type DoubtUpsertWithoutAnswersInput = {
    update: XOR<DoubtUpdateWithoutAnswersInput, DoubtUncheckedUpdateWithoutAnswersInput>
    create: XOR<DoubtCreateWithoutAnswersInput, DoubtUncheckedCreateWithoutAnswersInput>
    where?: DoubtWhereInput
  }

  export type DoubtUpdateToOneWithWhereWithoutAnswersInput = {
    where?: DoubtWhereInput
    data: XOR<DoubtUpdateWithoutAnswersInput, DoubtUncheckedUpdateWithoutAnswersInput>
  }

  export type DoubtUpdateWithoutAnswersInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    postedBy?: UserUpdateOneRequiredWithoutDoubtsNestedInput
  }

  export type DoubtUncheckedUpdateWithoutAnswersInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    postedById?: StringFieldUpdateOperationsInput | string
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUpsertWithoutAnswersInput = {
    update: XOR<UserUpdateWithoutAnswersInput, UserUncheckedUpdateWithoutAnswersInput>
    create: XOR<UserCreateWithoutAnswersInput, UserUncheckedCreateWithoutAnswersInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAnswersInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAnswersInput, UserUncheckedUpdateWithoutAnswersInput>
  }

  export type UserUpdateWithoutAnswersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateWithoutAnswersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type UserCreateWithoutRaisedComplaintsInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    assignedComplaints?: ComplaintCreateNestedManyWithoutAssignedToInput
  }

  export type UserUncheckedCreateWithoutRaisedComplaintsInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    assignedComplaints?: ComplaintUncheckedCreateNestedManyWithoutAssignedToInput
  }

  export type UserCreateOrConnectWithoutRaisedComplaintsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutRaisedComplaintsInput, UserUncheckedCreateWithoutRaisedComplaintsInput>
  }

  export type UserCreateWithoutAssignedComplaintsInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileCreateNestedOneWithoutUserInput
    doubts?: DoubtCreateNestedManyWithoutPostedByInput
    answers?: AnswerCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintCreateNestedManyWithoutRaisedByInput
  }

  export type UserUncheckedCreateWithoutAssignedComplaintsInput = {
    id?: string
    name: string
    email: string
    password: string
    username: string
    role: $Enums.Role
    approvalStatus: $Enums.ApprovalStatus
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    studentProfile?: StudentProfileUncheckedCreateNestedOneWithoutUserInput
    facultyProfile?: FacultyProfileUncheckedCreateNestedOneWithoutUserInput
    adminProfile?: AdminProfileUncheckedCreateNestedOneWithoutUserInput
    doubts?: DoubtUncheckedCreateNestedManyWithoutPostedByInput
    answers?: AnswerUncheckedCreateNestedManyWithoutAnsweredByInput
    raisedComplaints?: ComplaintUncheckedCreateNestedManyWithoutRaisedByInput
  }

  export type UserCreateOrConnectWithoutAssignedComplaintsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAssignedComplaintsInput, UserUncheckedCreateWithoutAssignedComplaintsInput>
  }

  export type UserUpsertWithoutRaisedComplaintsInput = {
    update: XOR<UserUpdateWithoutRaisedComplaintsInput, UserUncheckedUpdateWithoutRaisedComplaintsInput>
    create: XOR<UserCreateWithoutRaisedComplaintsInput, UserUncheckedCreateWithoutRaisedComplaintsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutRaisedComplaintsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutRaisedComplaintsInput, UserUncheckedUpdateWithoutRaisedComplaintsInput>
  }

  export type UserUpdateWithoutRaisedComplaintsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    assignedComplaints?: ComplaintUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUncheckedUpdateWithoutRaisedComplaintsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    assignedComplaints?: ComplaintUncheckedUpdateManyWithoutAssignedToNestedInput
  }

  export type UserUpsertWithoutAssignedComplaintsInput = {
    update: XOR<UserUpdateWithoutAssignedComplaintsInput, UserUncheckedUpdateWithoutAssignedComplaintsInput>
    create: XOR<UserCreateWithoutAssignedComplaintsInput, UserUncheckedCreateWithoutAssignedComplaintsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAssignedComplaintsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAssignedComplaintsInput, UserUncheckedUpdateWithoutAssignedComplaintsInput>
  }

  export type UserUpdateWithoutAssignedComplaintsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUpdateOneWithoutUserNestedInput
    doubts?: DoubtUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUpdateManyWithoutRaisedByNestedInput
  }

  export type UserUncheckedUpdateWithoutAssignedComplaintsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    approvalStatus?: EnumApprovalStatusFieldUpdateOperationsInput | $Enums.ApprovalStatus
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    studentProfile?: StudentProfileUncheckedUpdateOneWithoutUserNestedInput
    facultyProfile?: FacultyProfileUncheckedUpdateOneWithoutUserNestedInput
    adminProfile?: AdminProfileUncheckedUpdateOneWithoutUserNestedInput
    doubts?: DoubtUncheckedUpdateManyWithoutPostedByNestedInput
    answers?: AnswerUncheckedUpdateManyWithoutAnsweredByNestedInput
    raisedComplaints?: ComplaintUncheckedUpdateManyWithoutRaisedByNestedInput
  }

  export type DoubtCreateManyPostedByInput = {
    id?: string
    title: string
    description: string
    semester: number
    subject: $Enums.Subject
    labels?: DoubtCreatelabelsInput | string[]
    status?: $Enums.DoubtStatus
    views?: number
    upVoteCount?: number
    answerCount?: number
    acceptedAnswerId?: string | null
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnswerCreateManyAnsweredByInput = {
    id?: string
    doubtId: string
    content: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComplaintCreateManyRaisedByInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    assignedToId?: string | null
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComplaintCreateManyAssignedToInput = {
    id?: string
    title: string
    description: string
    category: $Enums.ComplaintCategory
    classroomNumber: string
    block: string
    status?: $Enums.ComplaintStatus
    priority: number
    raisedById: string
    resolutionNote?: string | null
    feedbackRating?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DoubtUpdateWithoutPostedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    answers?: AnswerUpdateManyWithoutDoubtNestedInput
  }

  export type DoubtUncheckedUpdateWithoutPostedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    answers?: AnswerUncheckedUpdateManyWithoutDoubtNestedInput
  }

  export type DoubtUncheckedUpdateManyWithoutPostedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    semester?: IntFieldUpdateOperationsInput | number
    subject?: EnumSubjectFieldUpdateOperationsInput | $Enums.Subject
    labels?: DoubtUpdatelabelsInput | string[]
    status?: EnumDoubtStatusFieldUpdateOperationsInput | $Enums.DoubtStatus
    views?: IntFieldUpdateOperationsInput | number
    upVoteCount?: IntFieldUpdateOperationsInput | number
    answerCount?: IntFieldUpdateOperationsInput | number
    acceptedAnswerId?: NullableStringFieldUpdateOperationsInput | string | null
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerUpdateWithoutAnsweredByInput = {
    id?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    doubt?: DoubtUpdateOneRequiredWithoutAnswersNestedInput
  }

  export type AnswerUncheckedUpdateWithoutAnsweredByInput = {
    id?: StringFieldUpdateOperationsInput | string
    doubtId?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerUncheckedUpdateManyWithoutAnsweredByInput = {
    id?: StringFieldUpdateOperationsInput | string
    doubtId?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintUpdateWithoutRaisedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    assignedTo?: UserUpdateOneWithoutAssignedComplaintsNestedInput
  }

  export type ComplaintUncheckedUpdateWithoutRaisedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    assignedToId?: NullableStringFieldUpdateOperationsInput | string | null
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintUncheckedUpdateManyWithoutRaisedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    assignedToId?: NullableStringFieldUpdateOperationsInput | string | null
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintUpdateWithoutAssignedToInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    raisedBy?: UserUpdateOneRequiredWithoutRaisedComplaintsNestedInput
  }

  export type ComplaintUncheckedUpdateWithoutAssignedToInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    raisedById?: StringFieldUpdateOperationsInput | string
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComplaintUncheckedUpdateManyWithoutAssignedToInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: EnumComplaintCategoryFieldUpdateOperationsInput | $Enums.ComplaintCategory
    classroomNumber?: StringFieldUpdateOperationsInput | string
    block?: StringFieldUpdateOperationsInput | string
    status?: EnumComplaintStatusFieldUpdateOperationsInput | $Enums.ComplaintStatus
    priority?: IntFieldUpdateOperationsInput | number
    raisedById?: StringFieldUpdateOperationsInput | string
    resolutionNote?: NullableStringFieldUpdateOperationsInput | string | null
    feedbackRating?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerCreateManyDoubtInput = {
    id?: string
    content: string
    answeredById: string
    upvotes?: number
    isVerified?: boolean
    isAccepted?: boolean
    edited?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AnswerUpdateWithoutDoubtInput = {
    id?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    answeredBy?: UserUpdateOneRequiredWithoutAnswersNestedInput
  }

  export type AnswerUncheckedUpdateWithoutDoubtInput = {
    id?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    answeredById?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AnswerUncheckedUpdateManyWithoutDoubtInput = {
    id?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    answeredById?: StringFieldUpdateOperationsInput | string
    upvotes?: IntFieldUpdateOperationsInput | number
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    isAccepted?: BoolFieldUpdateOperationsInput | boolean
    edited?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}