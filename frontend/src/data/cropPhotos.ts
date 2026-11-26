/**
 * Ảnh thực tế cho từng loại cây / vật nuôi (mã trong bảng crops): ảnh thu nhỏ 500px tải từ Wikimedia Commons.
 * Ảnh nào cũng có giấy phép tự do; CC BY / CC BY-SA bắt buộc ghi tác giả và giấy phép, trang Ruộng của tôi hiện phần này.
 * Thêm ảnh: tải ảnh thu nhỏ vào public/crops/<mã>.<đuôi> rồi thêm một dòng ở đây.
 */
export interface CropPhoto {
  src: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  /** Trang của file trên Wikimedia Commons */
  sourceUrl: string;
}

export const CROP_PHOTOS: Record<string, CropPhoto> = {
  buoi: { src: '/crops/buoi.jpg', author: 'Ivar Leidus', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pomelo_fruit.jpg' },
  ca_basa: { src: '/crops/ca_basa.jpg', author: 'Alpha', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Basa_fish_-_Vinh_Long_Market.jpg' },
  ca_loc: { src: '/crops/ca_loc.jpg', author: 'renjus box', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Channa_striata_342778351.jpg' },
  ca_ro_dong: { src: '/crops/ca_ro_dong.jpg', author: 'Abu Hamas', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Anabas_testudineus_52464852.jpg' },
  ca_that_lat: { src: '/crops/ca_that_lat.jpg', author: 'Xufanc', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Chitala_ornata_(Chiang_Rai,_Thailand).jpg' },
  ca_tra: { src: '/crops/ca_tra.png', author: 'Trương Minh Khải', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pangasianodon_hypophthalmus_in_Dong_Nai_river,_Vietnam.png' },
  cam: { src: '/crops/cam.jpg', author: 'Ivar Leidus', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Oranges_-_whole-halved-segment.jpg' },
  chom_chom: { src: '/crops/chom_chom.jpg', author: 'ArionStar', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rambut%C3%A3o.jpg' },
  dua: { src: '/crops/dua.jpg', author: 'Ivar Leidus', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coconuts_-_single_and_cracked_open.jpg' },
  lua: { src: '/crops/lua.jpg', author: 'Kalaiyarasiselvam', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rice_plant_(Oryza_sativa).jpg' },
  mang_cut: { src: '/crops/mang_cut.jpg', author: 'Ivar Leidus', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mangosteens_-_whole_and_opened.jpg' },
  mia: { src: '/crops/mia.jpg', author: 'Forest and Kim Starr', license: 'CC BY 3.0 us', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/us', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Starr-090413-5778-Saccharum_officinarum-fields-Kahului-Maui_(24925065236).jpg' },
  nuoc_sinh_hoat: { src: '/crops/nuoc_sinh_hoat.jpg', author: 'Klaus Ohlenschläger', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Trinkwasser-Wasserhahn.jpg' },
  quyt: { src: '/crops/quyt.jpg', author: 'SKas', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mandarins_in_my_Garden_Sochi.JPG' },
  rau_mau: { src: '/crops/rau_mau.jpg', author: 'Dinkum', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Travaux_des_champs_Vietnam.JPG' },
  sau_rieng: { src: '/crops/sau_rieng.jpg', author: 'Carlquist, Sherwin John', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:(Durio_zibethinus_fruit_in_Bangkok,_Thailand)_-_DPLA_-_b133251c0ada9cf892f7f3dde12eedc4.jpg' },
  tom_cang_xanh: { src: '/crops/tom_cang_xanh.jpg', author: 'KKPCW', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Macrobrachium_rosenbergii_in_Gifu_World_Fresh_Water_Aquarium_-_1.jpg' },
  tom_su: { src: '/crops/tom_su.jpg', author: 'Epipelagic', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Penaeus_monodon.jpg' },
  tom_the: { src: '/crops/tom_the.jpg', author: 'Không rõ tác giả', license: 'Public domain', licenseUrl: null, sourceUrl: 'https://commons.wikimedia.org/wiki/File:Penaeus_vannamei_01.jpg' },
  xoai: { src: '/crops/xoai.jpg', author: 'Ivar Leidus', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mangos_-_single_and_halved.jpg' },
};
