using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Altairis.ConventionalMetadataProviders;
using System.Globalization;
using Microsoft.AspNetCore.Localization;

namespace TestSite {
    public class Startup {
        private static readonly CultureInfo[] _supportedCultures = {
            new CultureInfo("en-US"),
            new CultureInfo("cs-CZ"),
        };

        public void ConfigureServices(IServiceCollection services) {
            services.AddMvc(options => {
                options.SetConventionalMetadataProviders(typeof(Resources.Display));
            });
        }

        public void Configure(IApplicationBuilder app) {
            app.UseRequestLocalization(new RequestLocalizationOptions {
                SupportedCultures = _supportedCultures,
                SupportedUICultures = _supportedCultures,
                DefaultRequestCulture = new RequestCulture(_supportedCultures[0]),
            });
            app.UseDeveloperExceptionPage();
            app.UseMvc();
            app.UseStaticFiles();
        }
    }
}
