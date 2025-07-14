/**
 * Export Button Component
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { FC, useCallback, useState } from 'react';
import useI18n from 'libs/web/hooks/use-i18n';
import { ButtonProps } from './type';
import { ROOT_ID } from 'libs/shared/tree';
import Link from 'next/link';
import { ButtonProgress } from 'components/button-progress';

export const ExportButton: FC<ButtonProps> = ({ parentId = ROOT_ID }) => {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);

    // Fake waiting time
    const handleClick = useCallback(() => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
        }, 2000);
    }, []);

    return (
        <Link href={`/api/export?pid=${parentId}`}>
            <ButtonProgress onClick={handleClick} loading={loading}>
                {t('Export')}
            </ButtonProgress>
        </Link>
    );
};
