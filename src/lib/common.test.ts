import { describe, expect, it } from 'vitest';
import { checkPixels, fit, outputName, parseRange, size } from './common';
describe('image dimensions', () => {
  it('fits a landscape or portrait without distortion', () => {
    expect(fit(2000,1000,1080,1080)).toEqual({width:1080,height:540});
    expect(fit(1000,2000,1080,1080)).toEqual({width:540,height:1080});
  });
  it('does not enlarge by default, allows opt-in enlargement and stretching', () => {
    expect(fit(100,50,1080,1080)).toEqual({width:100,height:50});
    expect(fit(100,50,1080,1080,true,true)).toEqual({width:1080,height:540});
    expect(fit(100,50,1080,1080,false,true)).toEqual({width:1080,height:1080});
  });
  it('rejects invalid sizes and excessive canvas allocations', () => {
    expect(() => fit(100,100,0,100)).toThrow('invalidDimensions');
    expect(() => fit(100,100,NaN,100)).toThrow();
    expect(() => checkPixels(12000,12000)).toThrow('tooManyPixels');
  });
});
describe('PDF range selection', () => {
  it('accepts single pages, ranges and duplicates in chosen order', () => expect(parseRange('3, 1-2, 3',5)).toEqual([2,0,1]));
  it('blank selects everything', () => expect(parseRange('',3)).toEqual([0,1,2]));
  it.each(['0','4','3-1','1-7','-1','1,,2','x','1.5'])('rejects invalid input %s', value => expect(() => parseRange(value,3)).toThrow('invalidRange'));
});
describe('output names & units', () => {
  it('handles Hebrew, multiple dots and extensionless names', () => {
    expect(outputName('קמפיין.v2.JPG','png')).toBe('קמפיין.v2-forma.png');
    expect(outputName('image','jpg')).toBe('image-forma.jpg');
    expect(size(2048)).toBe('2.0 KB');
    expect(size(1024*1024)).toBe('1.00 MB');
  });
});
