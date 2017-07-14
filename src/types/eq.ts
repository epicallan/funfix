/*
 * Copyright (c) 2017 by The Funfix Project Developers.
 * Some rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Exposes the {@link Eq} type class.
 *
 * À la carte imports work, assuming an ECMAScript 2015 compatible environment,
 * including ES2015 modules and `import` syntax:
 *
 * ```typescript
 * import { Eq } from "funfix/dist/types/eq"
 * // ... or ...
 * import { Eq } from "funfix/dist/types"
 * // ... or ...
 * import { Eq } from "funfix"
 * ```
 *
 * In absence of ES2015 compatibility, you can still rely on working with the
 * packaged (`pkg.main`) universal distribution that works within all browsers
 * and environments.
 *
 * @module types/eq
 */

/***/

import { Constructor, getTypeClassInstance } from "./kinds"

/**
 * The `Eq` is a type class used to determine equality between 2
 * instances of the same type. Any 2 instances `x` and `y` are equal
 * if `eqv(x, y)` is `true`. Moreover, `eqv` should form an
 * equivalence relation.
 *
 * Example:
 *
 * ```typescript
 * const F = eqOf(Option)
 *
 * F.eqv(Some(1), Some(1)) // true
 * F.eqv(Some(1), None)    // false
 * ```
 *
 * MUST obey the laws defined in {@link EqLaws}.
 *
 * CREDITS: this type class is inspired by the equivalent in Haskell's
 * standard library and the implementation is inspired by the
 * [Typelevel Cats]{@link http://typelevel.org/cats/} project.
 */
export abstract class Eq<A> {
  abstract eqv(lh: A, rh: A): boolean

  // Implements TypeClass<F>
  static readonly _funTypeId: string = "eq"
  static readonly _funSupertypeIds: string[] = []
  static readonly _funErasure: Eq<any>
}

export class EqLaws<A> {
  /**
   * @param F is the {@link Eq} designated instance for `A`, to be tested.
   */
  constructor(public F: Eq<A>) {}

  /**
   * Equality is reflexive, i.e.
   * ```
   * a == a
   * ```
   */
  reflexive(a: A): boolean {
    return this.F.eqv(a, a)
  }

  /**
   * Equality is symmetric, i.e.
   * ```
   * x == y <-> y == x
   * ```
   */
  symmetric(x: A, y: A): boolean {
    return this.F.eqv(x, y) === this.F.eqv(y, x)
  }

  /**
   * Equality is transitive, i.e.
   * ```
   * x == y && y == z -> x == z
   * ```
   */
  transitive(x: A, y: A, z: A): boolean {
    return !(this.F.eqv(x, y) && this.F.eqv(y, z)) || this.F.eqv(x, z)
  }
}

/**
 * Given a {@link Constructor} reference, returns its associated
 * {@link Eq} instance if it exists, or throws a {@link NotImplementedError}
 * in case there's no such association.
 *
 * ```typescript
 * import { Option, Eq, eqOf } from "funfix"
 *
 * const F: Eq<Option<any>> = eqOf(Option)
 * ```
 */
export const eqOf: <F>(c: Constructor<F>) => Eq<F> =
  getTypeClassInstance(Eq)
