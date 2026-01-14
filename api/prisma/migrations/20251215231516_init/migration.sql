-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `apiTokenHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Webhook` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Webhook_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Run` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `provider` VARCHAR(191) NULL,
    `repo` VARCHAR(191) NULL,
    `ref` VARCHAR(191) NULL,
    `sha` VARCHAR(191) NULL,
    `workflow` VARCHAR(191) NULL,
    `runId` VARCHAR(191) NULL,
    `runAttempt` INTEGER NULL,
    `prNumber` INTEGER NULL,
    `configJson` JSON NULL,

    INDEX `Run_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `Run_projectId_ref_idx`(`projectId`, `ref`),
    INDEX `Run_projectId_sha_idx`(`projectId`, `sha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Audit` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `route` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `seo` DOUBLE NOT NULL,
    `performance` DOUBLE NOT NULL,
    `accessibility` DOUBLE NOT NULL,
    `bestPractices` DOUBLE NOT NULL,
    `fcpMs` INTEGER NULL,
    `lcpMs` INTEGER NULL,
    `cls` DOUBLE NULL,
    `auditsJson` JSON NULL,

    INDEX `Audit_projectId_route_createdAt_idx`(`projectId`, `route`, `createdAt`),
    INDEX `Audit_runId_idx`(`runId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Webhook` ADD CONSTRAINT `Webhook_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Run` ADD CONSTRAINT `Run_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Audit` ADD CONSTRAINT `Audit_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `Run`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
