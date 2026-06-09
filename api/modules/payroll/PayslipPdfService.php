<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Dompdf\Dompdf;
use Dompdf\Options;

final class PayslipPdfService
{
    /** @param array<string, mixed> $payslipRow */
    public function generate(array $payslipRow): string
    {
        if (!class_exists(Dompdf::class)) {
            throw new \RuntimeException('PDF library missing. Run: composer install in the api folder.');
        }

        $html = PayslipRenderer::html($payslipRow, true);
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'Arial');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }
}
