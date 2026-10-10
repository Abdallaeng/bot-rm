/** تسميات العرض */
export const GOV = {
  Karbala: 'كربلاء', Babil: 'بابل', Baghdad: 'بغداد', Najaf: 'النجف', Qaddissiya: 'القادسية', Wassit: 'واسط',
  Muthanna: 'المثنى', 'Thi Qar': 'ذي قار', Basra: 'البصرة', Anbar: 'الأنبار', Diwaniyah: 'الديوانية',
};
export const IO = { Indoor: 'داخلي (Indoor)', Outdoor: 'خارجي (Outdoor)', 'Small cell': 'Small cell' };
export const govName = (code) => GOV[code] || code || '';
