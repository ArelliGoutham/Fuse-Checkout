import { generateInviteCode } from './invite-code';

describe('invite code generation', () => {
  it('generates a 6 character code', () => {
    const code = generateInviteCode();
    expect(code.length).toBe(6);
  });

  it('code matches valid character set [A-Z2-9]', () => {
    const code = generateInviteCode();
    const validPattern = /^[A-Z2-9]{6}$/;
    expect(code).toMatch(validPattern);
  });

  it('generates different codes on multiple calls', () => {
    const code1 = generateInviteCode();
    const code2 = generateInviteCode();
    const code3 = generateInviteCode();
    
    expect(code1).not.toBe(code2);
    expect(code2).not.toBe(code3);
    expect(code1).not.toBe(code3);
  });

  it('does not contain 0, 1, I, or O', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      expect(code).not.toContain('0');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
      expect(code).not.toContain('O');
    }
  });

  it('only contains uppercase letters and digits 2-9', () => {
    const allowedChars = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''));
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const char of code) {
        expect(allowedChars.has(char)).toBe(true);
      }
    }
  });
});
