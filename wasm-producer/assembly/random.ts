/** Deterministic seeded PRNG (xorshift32). Same seed always produces the same sequence. */
export class Random {
  private state: u32;

  constructor(seed: u32) {
    // xorshift32 cannot start from a zero state (it would stay zero forever), so guard against it.
    this.state = seed == 0 ? 0x9e3779b9 : seed;
  }

  /** Returns the next pseudo-random unsigned 32-bit integer and advances internal state. */
  nextU32(): u32 {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return x;
  }

  /** Returns a pseudo-random integer in the inclusive range [min, max]. */
  nextInt(min: i32, max: i32): i32 {
    const range: u32 = <u32>(max - min + 1);
    return min + <i32>(this.nextU32() % range);
  }
}
