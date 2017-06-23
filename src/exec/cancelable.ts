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

import { CompositeError, IllegalStateError } from "../core/errors"

/**
 * `Cancelable` represents a one-time idempotent action that can be
 * used to cancel async computations, or to release resources that
 * active data sources are holding.
 *
 * It is similar in spirit to `java.io.Closeable`, but without the I/O
 * focus, or to `IDisposable` in Microsoft .NET.
 *
 * ```typescript
 * // Scheduling execution with a 10 seconds delay
 * const ref = setTimeout(() => console.log("Hello1"), 10000)
 * const task = Cancelable.from(() => clearTimeout(ref))
 *
 * // If we change our mind
 * task.cancel()
 * ```
 *
 * In case some API requires the return of a `Cancelable` reference,
 * but there isn't anything that can be canceled, then
 * [[Cancelable.empty]] can be used to return a reusable reference
 * that doesn't do anything when canceled.
 *
 * ```typescript
 * const task = Cancelable.empty()
 *
 * // It's a no-op, doesn't do anything
 * task.cancel()
 * ```
 */
export abstract class Cancelable {
  /**
   * Cancels the unit of work represented by this reference.
   *
   * Guaranteed idempotence - calling it multiple times should have
   * the same side-effect as calling it only once.
   */
  public abstract cancel(): void

  /**
   * Lifts any callback into a `Cancelable` reference.
   *
   * ```typescript
   * const task = Cancelable.from(() => {
   *   console.log("I was canceled!")
   * })
   *
   * task.cancel()
   * //=> I was canceled!
   * ```
   *
   * The returned reference has guaranteed idempotence, so
   * calling it multiple times will trigger the given
   * callback only once.
   */
  public static from(cb: () => void): Cancelable {
    return new WrapFn(cb)
  }

  /**
   * Returns a reusable `Cancelable` reference that doesn't
   * do anything on `cancel`.
   */
  public static empty(): Cancelable {
    return Empty
  }

  /**
   * Returns a [[Cancelable]] implementation that represents an
   * immutable list of [[Cancelable]] references which can be canceled
   * as a group.
   *
   * ```typescript
   * val list = Cancelable.collection(
   *   Cancelable.from(() => console.log("Cancelled #1")),
   *   Cancelable.from(() => console.log("Cancelled #2")),
   *   Cancelable.from(() => console.log("Cancelled #3"))
   * )
   *
   * list.cancel()
   * //=> Cancelled #1
   * //=> Cancelled #2
   * //=> Cancelled #3
   * ```
   *
   * @param refs is the array of references to cancel when
   *        cancellation is triggered
   */
  public static collection(...refs: Array<Cancelable>): Cancelable {
    return new CollectionCancelable(refs)
  }
}

/**
 * Concrete [[Cancelable]] implementation that wraps a callback.
 *
 * Implementation is package private, use [[Cancelable.from]]
 * to instantiate it.
 *
 * @Private
 */
class WrapFn extends Cancelable {
  protected thunk: null | (() => void)

  constructor(cb: () => void) {
    super()
    this.thunk = cb
  }

  cancel() {
    if (this.thunk !== null) {
      const ref = this.thunk
      this.thunk = null
      ref()
    }
  }
}

/**
 * Reusable [[Cancelable]] reference that doesn't do anything on
 * cancel.
 *
 * Implementation is package private, to access it use
 * [[Cancelable.empty]].
 *
 * @Hidden
 */
const Empty: Cancelable =
  new (class Empty extends Cancelable {
    cancel() {}
  })()

/**
 * `BoolCancelable` represents a [[Cancelable]] that can be queried
 * for the canceled status.
 */
export abstract class BoolCancelable extends Cancelable {
  /**
   * Return `true` in case this cancelable hasn't been canceled,
   * or `false` otherwise.
   *
   * ```typescript
   * const ref = BoolCancelable.from()
   * ```
   */
  public abstract isCanceled(): boolean

  /**
   * Lifts any callback into a `BoolCancelable` reference.
   *
   * ```typescript
   * const task = BoolCancelable.from(() => {
   *   console.log("I was canceled!")
   * })
   *
   * task.isCanceled()
   * //=> false
   *
   * task.cancel()
   * //=> I was canceled!
   *
   * task.isCanceled()
   * //=> true
   * ```
   *
   * The returned reference has guaranteed idempotence, so
   * calling it multiple times will trigger the given
   * callback only once.
   */
  public static from(cb: () => void): BoolCancelable {
    return new BoolWrapFn(cb)
  }

  /**
   * Returns a [[BoolCancelable]] implementation that doesn't do
   * anything on `cancel` except for changing the status of `isCanceled`
   * from `false` to `true`.
   *
   * ```typescript
   * const task = BoolCancelable.empty()
   *
   * task.isCanceled()
   * //=> false
   *
   * task.cancel()
   * task.isCanceled()
   * //=> true
   * ```
   */
  public static empty(): BoolCancelable {
    return new BoolEmpty()
  }

  /**
   * Returns a [[BoolCancelable]] reference that is already canceled.
   *
   * ```typescript
   * const ref = BoolCancelable.alreadyCanceled()
   *
   * ref.isCanceled()
   * //=> true
   *
   * // Doesn't do anything, it's a no-op
   * ref.cancel()
   * ```
   *
   * The implementation returns the same reusable reference.
   */
  public static alreadyCanceled(): BoolCancelable {
    return AlreadyCanceled
  }

  /**
   * Returns a [[BoolCancelable]] implementation that represents an
   * immutable list of [[Cancelable]] references which can be
   * canceled as a group.
   *
   * ```typescript
   * val list = BoolCancelable.collection(
   *   Cancelable.from(() => console.log("Cancelled #1")),
   *   Cancelable.from(() => console.log("Cancelled #2")),
   *   Cancelable.from(() => console.log("Cancelled #3"))
   * )
   *
   * list.cancel()
   * //=> Cancelled #1
   * //=> Cancelled #2
   * //=> Cancelled #3
   * ```
   *
   * @param refs is the array of references to cancel when
   *        cancellation is triggered
   */
  public static collection(...refs: Array<Cancelable>): BoolCancelable {
    return new CollectionCancelable(refs)
  }
}

/**
 * [[Cancelable]] implementation that represents an immutable list of
 * [[Cancelable]] references which can be canceled as a group.
 *
 * Implementation is package private, to access it use
 * [[Cancelable.collection]].
 *
 * @Hidden
 */
class CollectionCancelable extends BoolCancelable {
  private _refs: Cancelable[]
  private _isCanceled: boolean

  constructor(refs: Cancelable[]) {
    super()
    this._refs = refs
    this._isCanceled = false
  }

  public isCanceled(): boolean {
    return this._isCanceled
  }

  public cancel(): void {
    if (!this._isCanceled) {
      this._isCanceled = true
      const errors = []
      for (const c of this._refs) {
        try { c.cancel() } catch (e) { errors.push(e) }
      }

      this._refs = [] // GC purposes
      if (errors.length === 1) throw errors[0]
      else if (errors.length > 1) throw new CompositeError(errors)
    }
  }
}

/**
 * Concrete [[BoolCancelable]] implementation that wraps a callback.
 *
 * Implementation is package private, use [[BoolCancelable.from]]
 * to instantiate it.
 *
 * @Hidden
 */
class BoolWrapFn extends WrapFn implements BoolCancelable {
  isCanceled() { return this.thunk === null }
}

/**
 * Concrete [[BoolCancelable]] implementation that doesn't do
 * anything on `cancel` except for changing the status of `isCanceled`
 * from `false` to `true`.
 *
 * Implementation is package private, use [[BoolCancelable.empty]]
 * to instantiate it.
 *
 * @Hidden
 */
class BoolEmpty extends BoolCancelable {
  private canceled: boolean = false

  isCanceled(): boolean { return this.canceled }
  public cancel(): void { this.canceled = true }
}

/**
 * Reusable [[BoolCancelable]] reference that's already canceled.
 *
 * Implementation is package private, to access it use
 * [[BoolCancelable.alreadyCanceled]].
 *
 * @Hidden
 */
const AlreadyCanceled: BoolCancelable =
  new (class AlreadyCanceled extends BoolCancelable {
    isCanceled() { return true }
    cancel() {}
  })()

/**
 * Represents a type of [[Cancelable]] that can hold
 * an internal reference to another cancelable (and thus
 * has to support the `update` operation).
 *
 * On assignment, if this cancelable is already
 * canceled, then no assignment should happen and the update
 * reference should be canceled as well.
 */
export abstract class AssignableCancelable extends BoolCancelable {
  /**
   * Updates the internal reference of this assignable cancelable
   * to the given value.
   *
   * If this cancelable is already canceled, then `value` is
   * going to be canceled on assignment as well.
   */
  public abstract update(value: Cancelable): this

  /**
   * Returns an [[AssignableCancelable]] reference that is already
   * canceled.
   *
   * ```typescript
   * const ref = AssignableCancelable.alreadyCanceled()
   * ref.isCanceled() //=> true
   *
   * const c = BooleanCancelable.empty()
   * ref.update(c) // cancels c
   * c.isCanceled() // true
   * ```
   *
   * The implementation returns the same reusable reference.
   */
  public static alreadyCanceled(): AssignableCancelable {
    return AlreadyCanceledAssignable
  }

  /**
   * Returns a new [[AssignableCancelable]] that's empty.
   *
   * The returned reference is an instance of
   * [[MultiAssignmentCancelable]], but this is an implementation
   * detail that may change in the future.
   */
  public static empty(): AssignableCancelable {
    return MultiAssignmentCancelable.empty()
  }

  /**
   * Initiates an [[AssignableCancelable]] reference and assigns it
   * a reference that wraps the given `cb` callback.
   *
   * So this code:
   *
   * ```typescript
   * AssignableCancelable.from(() => console.log("cancelled"))
   * ```
   *
   * Is equivalent to this:
   *
   * ```typescript
   * const ref = AssignableCancelable.empty()
   * ref.update(Cancelable.from(() => console.log("cancelled")))
   * ```
   */
  public static from(cb: () => void): AssignableCancelable {
    return MultiAssignmentCancelable.from(cb)
  }
}

/**
 * Internal reusable reference for [[AssignableCancelable]].
 * @Hidden
 */
const AlreadyCanceledAssignable: AssignableCancelable =
  new (class AlreadyCanceledAssignable extends AssignableCancelable {
    isCanceled() { return true }
    cancel() {}
    update(value: Cancelable) { value.cancel(); return this }
  })()

/**
 * The `MultiAssignmentCancelable` is a [[Cancelable]] whose
 * underlying cancelable reference can be swapped for another.
 *
 * Example:
 *
 * ```typescript
 * const ref = MultiAssignmentCancelable()
 * ref.update(c1) // sets the underlying cancelable to c1
 * ref.update(c2) // swaps the underlying cancelable to c2
 *
 * ref.cancel() // also cancels c2
 * ref := c3 // also cancels c3, because s is already canceled
 * ```
 *
 * Also see [[SerialCancelable]], which is similar, except that it
 * cancels the old cancelable upon assigning a new cancelable.
 */
export class MultiAssignmentCancelable extends AssignableCancelable {
  private _underlying?: Cancelable
  private _canceled: boolean

  constructor(initial?: Cancelable) {
    super()
    this._underlying = initial
    this._canceled = false
  }

  /** @inheritdoc */
  public update(value: Cancelable): this {
    if (this._canceled) value.cancel()
    else this._underlying = value
    return this
  }

  /** @inheritdoc */
  public isCanceled(): boolean { return this._canceled }

  /** @inheritdoc */
  public cancel(): void {
    if (!this._canceled) {
      this._canceled = true
      if (this._underlying) {
        this._underlying.cancel()
        delete this._underlying
      }
    }
  }

  /**
   * Returns a new [[MultiAssignmentCancelable]] that's empty.
   */
  public static empty(): MultiAssignmentCancelable {
    return new MultiAssignmentCancelable()
  }

  /**
   * Initiates an [[MultiAssignmentCancelable]] reference and assigns it
   * a reference that wraps the given `cb` callback.
   *
   * So this code:
   *
   * ```typescript
   * MultiAssignmentCancelable.from(() => console.log("cancelled"))
   * ```
   *
   * Is equivalent to this:
   *
   * ```typescript
   * const ref = MultiAssignmentCancelable.empty()
   * ref.update(Cancelable.from(() => console.log("cancelled")))
   * ```
   */
  public static from(cb: () => void): MultiAssignmentCancelable {
    return new MultiAssignmentCancelable(Cancelable.from(cb))
  }
}

/**
 * The `SerialCancelable` is a [[Cancelable]] whose underlying
 * cancelable reference can be swapped for another and on each
 * swap the previous reference gets canceled.
 *
 * Example:
 *
 * ```typescript
 * const ref = SerialAssignmentCancelable()
 * ref.update(c1) // sets the underlying cancelable to c1
 * ref.update(c2) // cancels c1, swaps the underlying cancelable to c2
 *
 * ref.cancel() // also cancels c2
 * ref := c3 // also cancels c3, because s is already canceled
 * ```
 *
 * Also see [[SerialCancelable]], which is similar, except that it
 * cancels the old cancelable upon assigning a new cancelable.
 */
export class SerialAssignmentCancelable extends AssignableCancelable {
  private _underlying?: Cancelable
  private _canceled: boolean

  constructor(initial?: Cancelable) {
    super()
    this._underlying = initial
    this._canceled = false
  }

  /** @inheritdoc */
  public update(value: Cancelable): this {
    if (this._canceled) value.cancel(); else {
      if (this._underlying) this._underlying.cancel()
      this._underlying = value
    }
    return this
  }

  /** @inheritdoc */
  public isCanceled(): boolean { return this._canceled }

  /** @inheritdoc */
  public cancel(): void {
    if (!this._canceled) {
      this._canceled = true
      if (this._underlying) {
        this._underlying.cancel()
        delete this._underlying
      }
    }
  }

  /**
   * Returns a new [[SerialAssignmentCancelable]] that's empty.
   */
  public static empty(): SerialAssignmentCancelable {
    return new SerialAssignmentCancelable()
  }

  /**
   * Initiates an [[SerialAssignmentCancelable]] reference and assigns it
   * a reference that wraps the given `cb` callback.
   *
   * So this code:
   *
   * ```typescript
   * SerialAssignmentCancelable.from(() => console.log("cancelled"))
   * ```
   *
   * Is equivalent to this:
   *
   * ```typescript
   * const ref = SerialAssignmentCancelable.empty()
   * ref.update(Cancelable.from(() => console.log("cancelled")))
   * ```
   */
  public static from(cb: () => void): SerialAssignmentCancelable {
    return new SerialAssignmentCancelable(Cancelable.from(cb))
  }
}

/**
 * The `SingleAssignmentCancelable` is a [[Cancelable]] that can be
 * assigned only once to another cancelable reference.
 *
 * Example:
 *
 * ```typescript
 * const ref = SingleAssignmentCancelable()
 * ref.update(c1) // sets the underlying cancelable to c1
 *
 * ref.update(c2) // throws IllegalStateError
 * ```
 *
 * See [[MultiAssignmentCancelable]] for a similar type that can be
 * assigned multiple types.
 */
export class SingleAssignmentCancelable extends AssignableCancelable {
  private _wasAssigned: boolean
  private _canceled: boolean
  private _underlying?: Cancelable

  constructor() {
    super()
    this._canceled = false
    this._wasAssigned = false
  }

  /** @inheritdoc */
  public update(value: Cancelable): this {
    if (this._wasAssigned)
      throw new IllegalStateError("SingleAssignmentCancelable#update multiple times")

    this._wasAssigned = true
    if (this._canceled) value.cancel()
    else this._underlying = value
    return this
  }

  /** @inheritdoc */
  public isCanceled(): boolean { return this._canceled }

  /** @inheritdoc */
  public cancel(): void {
    if (!this._canceled) {
      this._canceled = true
      if (this._underlying) {
        this._underlying.cancel()
        delete this._underlying
      }
    }
  }

  /**
   * Returns a new [[SingleAssignmentCancelable]] that's empty.
   */
  public static empty(): SingleAssignmentCancelable {
    return new SingleAssignmentCancelable()
  }

  /**
   * Initiates an [[SingleAssignmentCancelable]] reference and assigns it
   * a reference that wraps the given `cb` callback.
   *
   * So this code:
   *
   * ```typescript
   * SingleAssignmentCancelable.from(() => console.log("cancelled"))
   * ```
   *
   * Is equivalent to this:
   *
   * ```typescript
   * const ref = SingleAssignmentCancelable.empty()
   * ref.update(Cancelable.from(() => console.log("cancelled")))
   * ```
   */
  public static from(cb: () => void): SingleAssignmentCancelable {
    const ref = new SingleAssignmentCancelable()
    ref.update(Cancelable.from(cb))
    return ref
  }
}
