export class SegmentTree {
  private segmentTree: number[];

  constructor(private inputArray: number[], private operation: (a: number, b: number) => number, private fallback: number) {
    this.segmentTree = this.initSegmentTree(this.inputArray);
    this.buildSegmentTree();
  }

  private initSegmentTree(inputArray: number[]) {
    let segmentTreeArrayLength;
    const inputArrayLength = inputArray.length;
    const currentPower = Math.floor(Math.log2(inputArrayLength));
    const nextPower = currentPower + 1;
    const nextPowerOfTwoNumber = 2 ** nextPower;
    segmentTreeArrayLength = (2 * nextPowerOfTwoNumber) - 1;
    return new Array(segmentTreeArrayLength).fill(null);
  }

  private buildSegmentTree() {
    const leftIndex = 0;
    const rightIndex = this.inputArray.length - 1;
    const position = 0;
    this.buildTreeRecursively(leftIndex, rightIndex, position);
  }

  private buildTreeRecursively(leftInputIndex: number, rightInputIndex: number, position: number) {
    if (leftInputIndex === rightInputIndex) {
      this.segmentTree[position] = this.inputArray[leftInputIndex];
      return;
    }
    const middleIndex = Math.floor((leftInputIndex + rightInputIndex) / 2);
    this.buildTreeRecursively(leftInputIndex, middleIndex, this.getLeftChildIndex(position));
    this.buildTreeRecursively(middleIndex + 1, rightInputIndex, this.getRightChildIndex(position));

    this.segmentTree[position] = this.operation(
      this.segmentTree[this.getLeftChildIndex(position)],
      this.segmentTree[this.getRightChildIndex(position)],
    );
  }

  rangeQuery(queryLeftIndex: number, queryRightIndex: number) {
    const leftIndex = 0;
    const rightIndex = this.inputArray.length - 1;
    const position = 0;

    return this.rangeQueryRecursive(
      queryLeftIndex,
      queryRightIndex,
      leftIndex,
      rightIndex,
      position,
    );
  }

  private rangeQueryRecursive(
    queryLeftIndex: number,
    queryRightIndex: number,
    leftIndex: number,
    rightIndex: number,
    position: number): number {
    if (queryLeftIndex <= leftIndex && queryRightIndex >= rightIndex) {
      return this.segmentTree[position];
    }

    if (queryLeftIndex > rightIndex || queryRightIndex < leftIndex) {
      return this.fallback;
    }

    const middleIndex = Math.floor((leftIndex + rightIndex) / 2);

    const leftOperationResult = this.rangeQueryRecursive(
      queryLeftIndex,
      queryRightIndex,
      leftIndex,
      middleIndex,
      this.getLeftChildIndex(position),
    );

    const rightOperationResult = this.rangeQueryRecursive(
      queryLeftIndex,
      queryRightIndex,
      middleIndex + 1,
      rightIndex,
      this.getRightChildIndex(position),
    );

    return this.operation(leftOperationResult, rightOperationResult);
  }

  private getLeftChildIndex(parentIndex: number) {
    return (2 * parentIndex) + 1;
  }

  private getRightChildIndex(parentIndex: number) {
    return (2 * parentIndex) + 2;
  }
}