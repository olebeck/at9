class Atrac9Rng {
    _stateA: number
    _stateB: number
    _stateC: number
    _stateD: number
    constructor(seed: number) {
        const startValue = 0x4D93 * (seed ^ (seed >> 14));

        this._stateA = 3 - startValue;
        this._stateB = 2 - startValue;
        this._stateC = 1 - startValue;
        this._stateD = 0 - startValue;
    }

    next() {
        const t = this._stateD ^ (this._stateD << 5);
        this._stateD = this._stateC;
        this._stateC = this._stateB;
        this._stateB = this._stateA;
        this._stateA = t ^ this._stateA ^ ((t ^ (this._stateA >> 5)) >> 4);
        return this._stateA;
    }
}