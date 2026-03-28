import { Product } from './App';

export const INITIAL_PRODUCTS: Product[] = [
  { 
    id: '1', 
    name: "GLP-3 RT", 
    price: 86.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/glp3-rt_gfcapz.png", 
    description: "A 39-amino acid triple agonist peptide targeting GIP, GLP-1, and glucagon receptors, studied for metabolic pathway regulation and receptor binding kinetics in preclinical research models. Premium Research Peptide.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971440/1glp3-rt_x0z399.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971951/2glp3-rt_saynur.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971669/3glp3-rt_jjrejb.png"
    }
  },
  { 
    id: '2', 
    name: "BPC-157", 
    price: 67.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969218/bpc-157_vvwgot.png", 
    description: "Body Protective Compound-157 is a pentadecapeptide known for its potential regenerative properties in tendon, muscle, and gut research.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971445/1bpc-157_i2rout.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969687/2bpc-157_qtjw7b.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971672/3bpc-157_lxfd5j.png"
    }
  },
  { 
    id: '3', 
    name: "GHK-Cu", 
    price: 41.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/ghk-cu_k0gxxe.png", 
    description: "A copper-binding tripeptide naturally occurring in human plasma with research applications in skin remodeling and anti-inflammatory studies.",
    dosage: "100MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971439/1ghk-cu_dv1gat.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969684/2ghk-cu_atd91e.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971670/3ghk-cu_gscj57.png"
    }
  },
  { 
    id: '4', 
    name: "MT-2", 
    price: 43.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/mt-2_acqigl.png", 
    description: "Melanotan II is a synthetic analog of the alpha-melanocyte-stimulating hormone, researched for its effects on skin pigmentation.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971442/1mt-2_hfg0jk.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969684/2mt-2_noa9bx.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971674/3mt-2_qujg6y.png"
    }
  },
  { 
    id: '5', 
    name: "Wolverine 10mg (BPC157/TB500)", 
    price: 77.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/wolverine_tl3buz.png", 
    description: "A research blend of BPC-157 and TB-500, designed for synergistic studies on tissue repair and recovery.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971442/1wolverine_mrof4h.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969687/2wolverine_locrq5.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971671/3wolverine_nwvaiq.png"
    }
  },
  { 
    id: '6', 
    name: "CJC 1295 no dac + Ipamorelin", 
    price: 84.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/cjc-ipamorelin_atfs5x.png", 
    description: "A combination of a GHRH analog and a ghrelin mimetic, used in research to study growth hormone secretion patterns.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971442/1cjc-ipamorelin_fz6px6.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969691/2cjc-ipamorelin_qi18jo.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971671/3cjc-ipamorelin_nitxpm.png"
    }
  },
  { 
    id: '7', 
    name: "Bacteriostatic Water", 
    price: 14.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/BacWater_vl81li.png", 
    description: "Sterile water containing 0.9% benzyl alcohol, used as a diluent for reconstituting research compounds.",
    dosage: "10ML",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971439/1BacWater_vml33g.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969683/2BacWater_cu9qeq.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971668/3BacWater_jdwp5p.png"
    }
  },
  { 
    id: '8', 
    name: "Tesamorelin", 
    price: 92.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/tesamorelin_oydzju.png", 
    description: "A synthetic analog of growth hormone-releasing factor (GRF), researched for its effects on visceral adipose tissue.",
    dosage: "10MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971444/1tesamorelin_ehldd7.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969687/2tesamorelin_s9a2jn.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971675/3tesamorelin_wpphtb.png"
    }
  },
  { 
    id: '9', 
    name: "GLOW", 
    price: 112.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969218/glow_jfpqo0.png", 
    description: "A specialized research blend designed for studies related to skin health, collagen production, and cellular vitality.",
    dosage: "70MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971444/1glow_detdjm.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969688/2glow_b4ssod.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971674/3glow_i30p3b.png"
    }
  },
  { 
    id: '10', 
    name: "NAD+", 
    price: 77.99, 
    category: "Peptides", 
    image: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969217/nad_sxoz3j.png", 
    description: "Nicotinamide Adenine Dinucleotide is a critical coenzyme found in all living cells, researched for its role in energy metabolism and DNA repair.",
    dosage: "500MG",
    quantityImages: { 
      1: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971439/1nad_q367m5.png",
      2: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773969683/2nad_y1kupy.png",
      3: "https://res.cloudinary.com/ditxwmhnj/image/upload/v1773971669/3nad_o7dofh.png"
    }
  }
];
