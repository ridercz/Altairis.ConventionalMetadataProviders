using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Altairis.ConventionalMetadataProviders;
using System.Globalization;

namespace TestSite {
    public class Startup {
        public void ConfigureServices(IServiceCollection services) {
            services.AddMvc(options => {
                options.SetConventionalMetadataProviders(typeof(Resources.Display));
            });
        }

        public void Configure(IApplicationBuilder app) {
            app.Use((context, next) => {
                CultureInfo.CurrentCulture = new CultureInfo("cs-CZ");
                CultureInfo.CurrentUICulture = new CultureInfo("cs-CZ");
                return next();
            });
            app.UseDeveloperExceptionPage();
            app.UseMvc();
            app.UseStaticFiles();
        }
    }
}
