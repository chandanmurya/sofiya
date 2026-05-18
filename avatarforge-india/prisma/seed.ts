// ============================================
// Database Seed - Script Templates
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Script Templates
  await prisma.scriptTemplate.createMany({
    data: [
      {
        name: 'Instagram Reel (Hindi)',
        nameHi: 'इंस्टाग्राम रील (हिंदी)',
        category: 'reel',
        language: 'hi',
        script: 'नमस्ते दोस्तों! आज मैं आपको बताने वाला हूं एक ऐसी चीज़ जो आपकी ज़िंदगी बदल देगी। अगर आप भी [TOPIC] के बारे में जानना चाहते हैं तो यह वीडियो आपके लिए है। तो चलिए शुरू करते हैं!',
        aspectRatio: 'PORTRAIT_9_16',
        sortOrder: 1,
      },
      {
        name: 'Instagram Reel (English)',
        nameHi: 'इंस्टाग्राम रील (अंग्रेजी)',
        category: 'reel',
        language: 'en',
        script: 'Hey everyone! Today I want to share something that completely changed how I approach [TOPIC]. If you are struggling with this, stay till the end because I have a game-changer for you. Let us dive in!',
        aspectRatio: 'PORTRAIT_9_16',
        sortOrder: 2,
      },
      {
        name: 'Educational Explainer',
        nameHi: 'शैक्षिक एक्सप्लेनर',
        category: 'education',
        language: 'en',
        script: 'In this video, I will explain the concept of [TOPIC] in simple terms that anyone can understand. Whether you are a beginner or have some experience, by the end of this video, you will have a clear understanding of how [TOPIC] works and why it matters. So let us get started.',
        aspectRatio: 'LANDSCAPE_16_9',
        sortOrder: 3,
      },
      {
        name: 'Product Promo Ad',
        nameHi: 'प्रोडक्ट प्रोमो विज्ञापन',
        category: 'promo',
        language: 'en',
        script: 'Introducing [PRODUCT] - the solution you have been waiting for. Here is why thousands of people trust us: First, [BENEFIT 1]. Second, [BENEFIT 2]. And the best part? [BENEFIT 3]. Try it today and see the difference for yourself. Link in the description!',
        aspectRatio: 'PORTRAIT_9_16',
        sortOrder: 4,
      },
      {
        name: 'YouTube Channel Intro',
        nameHi: 'YouTube चैनल इंट्रो',
        category: 'intro',
        language: 'en',
        script: 'Welcome to my channel! I am [NAME] and here I share content about [TOPIC]. If you enjoy learning about [TOPIC], make sure to subscribe and hit the bell icon so you never miss a new video. Now let us get into today\'s topic!',
        aspectRatio: 'LANDSCAPE_16_9',
        sortOrder: 5,
      },
      {
        name: 'Business Pitch (Hinglish)',
        nameHi: 'बिजनेस पिच (हिंगलिश)',
        category: 'promo',
        language: 'hinglish',
        script: 'Hi friends! Main hoon [NAME] aur aaj main aapko batata hoon [PRODUCT] ke baare mein. Agar aap [PROBLEM] se pareshan hain, toh yeh solution aapke liye perfect hai. Humne 1000+ customers ko help kiya hai. Abhi try karein - link description mein hai!',
        aspectRatio: 'PORTRAIT_9_16',
        sortOrder: 6,
      },
      {
        name: 'Course Promo',
        nameHi: 'कोर्स प्रोमो',
        category: 'education',
        language: 'en',
        script: 'Want to master [SKILL] in just [TIMEFRAME]? My comprehensive course covers everything from basics to advanced concepts. With hands-on projects and lifetime access, you will be industry-ready. Join over [NUMBER] students who have already transformed their careers. Enroll now!',
        aspectRatio: 'LANDSCAPE_16_9',
        sortOrder: 7,
      },
      {
        name: 'Testimonial Style',
        nameHi: 'टेस्टीमोनियल स्टाइल',
        category: 'promo',
        language: 'en',
        script: 'Before using [PRODUCT], I was struggling with [PROBLEM]. But after just [TIMEFRAME] of using it, I saw incredible results. My [METRIC] improved by [PERCENTAGE]. If you are facing similar challenges, I highly recommend giving it a try.',
        aspectRatio: 'PORTRAIT_9_16',
        sortOrder: 8,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
