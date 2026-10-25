package kz.greenleaf.store.site;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import kz.greenleaf.store.site.SiteSettingsService.CompanyVideo;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/settings")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: settings")
public class AdminSiteSettingsController {

    private final SiteSettingsService settings;

    public AdminSiteSettingsController(SiteSettingsService settings) {
        this.settings = settings;
    }

    public record VideoLinkRequest(@Size(max = 500) String url, @Size(max = 200) String title) {
    }

    @GetMapping("/company-video")
    public CompanyVideo companyVideo() {
        return settings.companyVideo();
    }

    @PutMapping("/company-video")
    @Operation(summary = "Видео о компании на главной: ссылка (YouTube и т. п.) и подпись")
    public CompanyVideo setLink(@Valid @RequestBody VideoLinkRequest request) {
        settings.setCompanyVideoLink(request.url(), request.title());
        return settings.companyVideo();
    }

    @PostMapping(value = "/company-video/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Загрузить свой видеофайл о компании (MP4, WEBM, MOV до 200 МБ)")
    public CompanyVideo upload(@RequestPart("file") MultipartFile file,
                               @RequestParam(required = false) String title) {
        settings.uploadCompanyVideo(file, title != null && title.length() > 200 ? title.substring(0, 200) : title);
        return settings.companyVideo();
    }

    @DeleteMapping("/company-video")
    @Operation(summary = "Вернуть видео по умолчанию")
    public CompanyVideo reset() {
        settings.resetCompanyVideo();
        return settings.companyVideo();
    }
}
