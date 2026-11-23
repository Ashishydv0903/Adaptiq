/**
 * @file Coding Round Questions Seed
 * Includes starter code for JS, Python, Java, and C++,
 * visible & hidden test cases, runtime/memory benchmarks,
 * and 3-level costed hints.
 */

export const codingQuestions = [
  {
    title: 'Two Sum Target Lookup',
    prompt:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
    track: 'fullstack',
    roundType: 'coding',
    difficultyLevel: 'easy',
    skillSlug: 'javascript-core',
    irtParams: { a: 1.2, b: -0.5, c: 0.1 },
    codeStub: {
      language: 'javascript',
      starterCode: `function solution(nums, target) {
  // Write your code here
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
      solutionTemplate: `function solution(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`
    },
    starterCodes: {
      javascript: `function solution(nums, target) {
  // Your code here
  return [];
}`,
      python: `def solution(nums, target):
    # Your code here
    return []`,
      java: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Your code here
        return new int[]{};
    }
}`,
      cpp: `#include <vector>
using namespace std;

class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Your code here
        return {};
    }
};`
    },
    testCases: [
      {
        input: '[[2, 7, 11, 15], 9]',
        expectedOutput: '[0,1]',
        isHidden: false,
        explanation: 'nums[0] + nums[1] = 2 + 7 = 9'
      },
      {
        input: '[[3, 2, 4], 6]',
        expectedOutput: '[1,2]',
        isHidden: false,
        explanation: 'nums[1] + nums[2] = 2 + 4 = 6'
      },
      {
        input: '[[3, 3], 6]',
        expectedOutput: '[0,1]',
        isHidden: false,
        explanation: 'nums[0] + nums[1] = 3 + 3 = 6'
      },
      // Hidden test cases for competitive grading
      {
        input: '[[-1, -2, -3, -4, -5], -8]',
        expectedOutput: '[2,4]',
        isHidden: true,
        explanation: 'Negative numbers complement test'
      },
      {
        input: '[[1000000, 500, 1000000], 2000000]',
        expectedOutput: '[0,2]',
        isHidden: true,
        explanation: 'Large numbers boundary test'
      }
    ],
    hints: [
      {
        level: 1,
        penaltyPoints: 2,
        hintText: 'A brute force approach searches all pairs in O(N²). Can an auxiliary data structure enable lookups in constant O(1) time?'
      },
      {
        level: 2,
        penaltyPoints: 5,
        hintText: 'As you iterate through the list, compute complement = target - nums[i]. Check if this complement has already been stored in a Hash Map.'
      },
      {
        level: 3,
        penaltyPoints: 10,
        hintText: 'Pseudocode: 1. Initialize map = new Map(). 2. Loop i from 0 to nums.length-1. 3. If map.has(target - nums[i]), return [map.get(target - nums[i]), i]. 4. Else map.set(nums[i], i).'
      }
    ],
    idealAnswer:
      'We use a hash map to record seen numbers and their indices. In a single linear scan O(N), for each element x we calculate the complement (target - x) and look it up in O(1) amortized time. This achieves optimal O(N) time complexity and O(N) space complexity.',
    rubricWeights: {
      technicalAccuracy: 0.4,
      conceptualDepth: 0.2,
      communication: 0.1,
      codeEfficiency: 0.3,
      problemSolving: 0.0
    }
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    prompt:
      'Given a string s, find the length of the longest substring without duplicate characters.',
    track: 'fullstack',
    roundType: 'coding',
    difficultyLevel: 'medium',
    skillSlug: 'javascript-core',
    irtParams: { a: 1.4, b: 0.4, c: 0.05 },
    codeStub: {
      language: 'javascript',
      starterCode: `function solution(s) {
  let maxLength = 0;
  let start = 0;
  const map = new Map();
  for (let end = 0; end < s.length; end++) {
    const char = s[end];
    if (map.has(char) && map.get(char) >= start) {
      start = map.get(char) + 1;
    }
    map.set(char, end);
    maxLength = Math.max(maxLength, end - start + 1);
  }
  return maxLength;
}`,
      solutionTemplate: `function solution(s) {
  let maxLength = 0;
  let start = 0;
  const map = new Map();
  for (let end = 0; end < s.length; end++) {
    const char = s[end];
    if (map.has(char) && map.get(char) >= start) {
      start = map.get(char) + 1;
    }
    map.set(char, end);
    maxLength = Math.max(maxLength, end - start + 1);
  }
  return maxLength;
}`
    },
    starterCodes: {
      javascript: `function solution(s) {
  // Your code here
  return 0;
}`,
      python: `def solution(s: str) -> int:
    # Your code here
    return 0`,
      java: `class Solution {
    public int solution(String s) {
        // Your code here
        return 0;
    }
}`,
      cpp: `#include <string>
using namespace std;

class Solution {
public:
    int solution(string s) {
        // Your code here
        return 0;
    }
};`
    },
    testCases: [
      {
        input: '"abcabcbb"',
        expectedOutput: '3',
        isHidden: false,
        explanation: 'The answer is "abc", with length 3.'
      },
      {
        input: '"bbbbb"',
        expectedOutput: '1',
        isHidden: false,
        explanation: 'The answer is "b", with length 1.'
      },
      {
        input: '"pwwkew"',
        expectedOutput: '3',
        isHidden: false,
        explanation: 'The answer is "wke", with length 3.'
      },
      // Hidden test cases
      {
        input: '""',
        expectedOutput: '0',
        isHidden: true,
        explanation: 'Empty string boundary check'
      },
      {
        input: '"abba"',
        expectedOutput: '2',
        isHidden: true,
        explanation: 'Sliding window pointer regression check'
      }
    ],
    hints: [
      {
        level: 1,
        penaltyPoints: 2,
        hintText: 'Use a Sliding Window pattern with two pointers (start and end) to maintain a window of unique characters.'
      },
      {
        level: 2,
        penaltyPoints: 5,
        hintText: 'Track the last seen index of each character in a Map or hash table. When encountering a duplicate, move the start pointer past the previous index of that character.'
      },
      {
        level: 3,
        penaltyPoints: 10,
        hintText: 'Be careful when updating the start pointer: ensure it only advances forward (e.g. start = Math.max(start, lastIndex + 1)) to prevent regression on characters outside the active window.'
      }
    ],
    idealAnswer:
      'We use the sliding window technique with a hash map storing character positions. The end pointer scans through string s. When a repeat character is seen, start pointer jumps directly to Math.max(start, map.get(char) + 1). Time complexity is O(N) and space complexity is O(min(m, n)) where m is charset size.',
    rubricWeights: {
      technicalAccuracy: 0.35,
      conceptualDepth: 0.25,
      communication: 0.1,
      codeEfficiency: 0.3,
      problemSolving: 0.0
    }
  },
  {
    title: 'Merge Overlapping Intervals',
    prompt:
      'Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
    track: 'backend',
    roundType: 'coding',
    difficultyLevel: 'medium',
    skillSlug: 'nodejs-runtime',
    irtParams: { a: 1.3, b: 0.3, c: 0.0 },
    codeStub: {
      language: 'javascript',
      starterCode: `function solution(intervals) {
  if (!intervals || intervals.length <= 1) return intervals;
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
}`,
      solutionTemplate: `function solution(intervals) {
  if (!intervals || intervals.length <= 1) return intervals;
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
}`
    },
    starterCodes: {
      javascript: `function solution(intervals) {
  // Your code here
  return [];
}`,
      python: `def solution(intervals):
    # Your code here
    return []`,
      java: `class Solution {
    public int[][] solution(int[][] intervals) {
        // Your code here
        return new int[][]{};
    }
}`,
      cpp: `#include <vector>
using namespace std;

class Solution {
public:
    vector<vector<int>> solution(vector<vector<int>>& intervals) {
        // Your code here
        return {};
    }
};`
    },
    testCases: [
      {
        input: '[[[1,3],[2,6],[8,10],[15,18]]]',
        expectedOutput: '[[1,6],[8,10],[15,18]]',
        isHidden: false,
        explanation: 'Intervals [1,3] and [2,6] overlap into [1,6].'
      },
      {
        input: '[[[1,4],[4,5]]]',
        expectedOutput: '[[1,5]]',
        isHidden: false,
        explanation: 'Intervals [1,4] and [4,5] are contiguous, merged into [1,5].'
      },
      // Hidden test cases
      {
        input: '[[[1,4],[2,3]]]',
        expectedOutput: '[[1,4]]',
        isHidden: true,
        explanation: 'Fully enclosed interval test'
      },
      {
        input: '[[[2,3],[4,5],[6,7],[8,9],[1,10]]]',
        expectedOutput: '[[1,10]]',
        isHidden: true,
        explanation: 'Unsorted and comprehensive span interval'
      }
    ],
    hints: [
      {
        level: 1,
        penaltyPoints: 2,
        hintText: 'Sort the intervals first by their start times. Once sorted, overlapping intervals will always appear consecutively.'
      },
      {
        level: 2,
        penaltyPoints: 5,
        hintText: 'Iterate through the sorted intervals. If the current interval start is <= the previous interval end, update the previous interval end to Math.max(last.end, current.end).'
      },
      {
        level: 3,
        penaltyPoints: 10,
        hintText: 'Pseudocode: intervals.sort((a,b) => a[0]-b[0]); merged = [intervals[0]]; for each interval: if current[0] <= merged.last[1] then merged.last[1] = Math.max(merged.last[1], current[1]) else merged.push(current).'
      }
    ],
    idealAnswer:
      'We sort intervals by start time in O(N log N). Then we linearly iterate through intervals maintaining a merged array. Overlapping check is current.start <= last.end. Space is O(N) to store merged intervals.',
    rubricWeights: {
      technicalAccuracy: 0.35,
      conceptualDepth: 0.25,
      communication: 0.1,
      codeEfficiency: 0.3,
      problemSolving: 0.0
    }
  }
];

export default codingQuestions;
