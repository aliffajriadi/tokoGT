'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSetting(key) {
  const setting = await prisma.setting.findUnique({
    where: { key },
  });
  return setting ? setting.value : null;
}

async function setSetting(key, value) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

module.exports = {
  getSetting,
  setSetting,
};
