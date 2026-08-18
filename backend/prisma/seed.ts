import { ensureBootstrapData } from "../src/lib/seed";
import prisma from "../src/lib/prisma";
ensureBootstrapData().finally(() => prisma.$disconnect());
